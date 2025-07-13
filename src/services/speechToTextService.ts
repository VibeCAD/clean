/**
 * Speech-to-Text Service
 * 
 * This service handles speech-to-text conversion using OpenAI's Whisper API including:
 * - Audio format validation and conversion
 * - OpenAI Whisper API integration
 * - Error handling with retry logic
 * - Progress tracking and callbacks
 * - Extensive logging and debugging
 */

import OpenAI from 'openai';
import type { AudioRecordingResult } from './audioRecordingService';

export interface SpeechToTextConfig {
  model: string; // Whisper model to use
  language?: string; // Language code (ISO 639-1)
  temperature?: number; // Sampling temperature
  maxRetries: number; // Maximum retry attempts
  retryDelay: number; // Delay between retries in milliseconds
  timeoutMs: number; // Request timeout in milliseconds
  maxFileSize: number; // Maximum file size in bytes
  supportedFormats: string[]; // Supported audio formats
}

export interface TranscriptionProgress {
  stage: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number; // 0-1
  message: string;
  estimatedTimeRemaining?: number; // seconds
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration: number; // Audio duration in seconds
  processingTime: number; // Processing time in milliseconds
  model: string;
  audioSize: number; // Original audio size in bytes
  timestamp: Date;
}

export interface TranscriptionError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  timestamp: Date;
}

export class SpeechToTextService {
  private openai: OpenAI;
  private config: SpeechToTextConfig;
  private progressCallbacks: ((progress: TranscriptionProgress) => void)[] = [];
  private abortController: AbortController | null = null;

  constructor(apiKey: string, config?: Partial<SpeechToTextConfig>) {
    console.log('🤖 Initializing SpeechToTextService...');
    
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });

    this.config = {
      model: 'whisper-1',
      language: 'en', // Default to English
      temperature: 0, // Deterministic output
      maxRetries: 3,
      retryDelay: 1000,
      timeoutMs: 30000, // 30 seconds
      maxFileSize: 25 * 1024 * 1024, // 25MB Whisper limit
      supportedFormats: ['webm', 'mp3', 'wav', 'flac', 'm4a', 'ogg'],
      ...config
    };

    console.log('🤖 SpeechToTextService initialized with config:', this.config);
  }

  /**
   * Convert audio recording to text using OpenAI Whisper
   */
  public async transcribeAudio(audioResult: AudioRecordingResult): Promise<TranscriptionResult> {
    console.log('🎯 Starting audio transcription...');
    console.log('📊 Audio details:', {
      duration: `${audioResult.duration.toFixed(2)}s`,
      size: `${(audioResult.size / 1024).toFixed(2)}KB`,
      mimeType: audioResult.mimeType
    });

    const startTime = Date.now();
    this.abortController = new AbortController();

    try {
      // Validate audio before processing
      this.validateAudio(audioResult);

      // Update progress
      this.updateProgress({
        stage: 'preparing',
        progress: 0.1,
        message: 'Preparing audio for transcription...'
      });

      // Convert audio to the right format for Whisper
      const audioFile = await this.prepareAudioForWhisper(audioResult);

      // Update progress
      this.updateProgress({
        stage: 'uploading',
        progress: 0.3,
        message: 'Uploading audio to OpenAI...'
      });

      // Transcribe with retry logic
      const transcription = await this.transcribeWithRetry(audioFile);

      // Update progress
      this.updateProgress({
        stage: 'processing',
        progress: 0.8,
        message: 'Processing transcription...'
      });

      // Process the result
      const result = this.processTranscriptionResult(transcription, audioResult, startTime);

      console.log('✅ Transcription completed successfully');
      console.log('📝 Transcription result:', {
        text: result.text,
        confidence: result.confidence,
        language: result.language,
        processingTime: `${result.processingTime}ms`
      });

      return result;

    } catch (error) {
      console.error('❌ Transcription failed:', error);
      
      const transcriptionError: TranscriptionError = {
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        details: error,
        retryable: this.isRetryableError(error),
        timestamp: new Date()
      };

      this.updateProgress({
        stage: 'error',
        progress: 0,
        message: `Transcription failed: ${transcriptionError.message}`
      });

      throw transcriptionError;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Validate audio file before processing
   */
  private validateAudio(audioResult: AudioRecordingResult): void {
    console.log('🔍 Validating audio file...');

    // Check file size
    if (audioResult.size > this.config.maxFileSize) {
      throw new Error(`Audio file too large: ${(audioResult.size / 1024 / 1024).toFixed(2)}MB (max: ${this.config.maxFileSize / 1024 / 1024}MB)`);
    }

    // Check duration (minimum 0.1 seconds)
    if (audioResult.duration < 0.1) {
      throw new Error(`Audio too short: ${audioResult.duration.toFixed(2)}s (min: 0.1s)`);
    }

    // Check format
    const format = this.extractFormatFromMimeType(audioResult.mimeType);
    if (!this.config.supportedFormats.includes(format)) {
      throw new Error(`Unsupported audio format: ${format} (supported: ${this.config.supportedFormats.join(', ')})`);
    }

    console.log('✅ Audio validation passed');
  }

  /**
   * Extract format from MIME type
   */
  private extractFormatFromMimeType(mimeType: string): string {
    const formatMap: { [key: string]: string } = {
      'audio/webm': 'webm',
      'audio/webm;codecs=opus': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/flac': 'flac',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg'
    };

    return formatMap[mimeType] || mimeType.split('/')[1] || 'unknown';
  }

  /**
   * Prepare audio file for Whisper API
   */
  private async prepareAudioForWhisper(audioResult: AudioRecordingResult): Promise<File> {
    console.log('⚙️ Preparing audio for Whisper API...');

    // Create a File object from the blob
    const format = this.extractFormatFromMimeType(audioResult.mimeType);
    const filename = `audio_${Date.now()}.${format}`;
    
    const file = new File([audioResult.blob], filename, {
      type: audioResult.mimeType,
      lastModified: Date.now()
    });

    console.log('📁 Created audio file:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)}KB`,
      type: file.type
    });

    return file;
  }

  /**
   * Transcribe audio with retry logic
   */
  private async transcribeWithRetry(audioFile: File): Promise<OpenAI.Audio.Transcription> {
    console.log('🔄 Starting transcription with retry logic...');

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        attempt++;
        console.log(`🎯 Transcription attempt ${attempt}/${this.config.maxRetries}`);

        const transcription = await this.openai.audio.transcriptions.create({
          file: audioFile,
          model: this.config.model,
          language: this.config.language,
          temperature: this.config.temperature,
          response_format: 'verbose_json'
        });

        console.log('✅ Transcription successful on attempt', attempt);
        return transcription;

      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Transcription attempt ${attempt} failed:`, error);

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          console.log('❌ Error is not retryable, giving up');
          break;
        }

        // Don't retry on last attempt
        if (attempt >= this.config.maxRetries) {
          console.log('❌ Maximum retry attempts reached');
          break;
        }

        // Wait before retrying
        const delay = this.config.retryDelay * attempt; // Exponential backoff
        console.log(`⏱️ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Transcription failed after maximum retries');
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;

    // Network errors are usually retryable
    if (error.name === 'NetworkError' || error.name === 'TypeError') {
      return true;
    }

    // OpenAI API errors
    if (error.status) {
      // Rate limiting, server errors are retryable
      if (error.status === 429 || error.status >= 500) {
        return true;
      }
      
      // Client errors are usually not retryable
      if (error.status >= 400 && error.status < 500) {
        return false;
      }
    }

    // Timeout errors are retryable
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return true;
    }

    // Default to not retryable
    return false;
  }

  /**
   * Process transcription result
   */
  private processTranscriptionResult(
    transcription: OpenAI.Audio.Transcription,
    audioResult: AudioRecordingResult,
    startTime: number
  ): TranscriptionResult {
    console.log('⚙️ Processing transcription result...');

    const processingTime = Date.now() - startTime;
    const text = transcription.text?.trim() || '';

    // Extract additional information from verbose response
    const language = (transcription as any).language || this.config.language;
    const confidence = this.calculateConfidence(transcription);

    const result: TranscriptionResult = {
      text,
      confidence,
      language,
      duration: audioResult.duration,
      processingTime,
      model: this.config.model,
      audioSize: audioResult.size,
      timestamp: new Date()
    };

    console.log('📝 Transcription result processed:', {
      textLength: text.length,
      processingTime: `${processingTime}ms`,
      confidence: confidence ? `${(confidence * 100).toFixed(1)}%` : 'unknown'
    });

    return result;
  }

  /**
   * Calculate confidence score from transcription segments
   */
  private calculateConfidence(transcription: OpenAI.Audio.Transcription): number | undefined {
    try {
      // Check if segments are available (verbose response)
      const segments = (transcription as any).segments;
      if (!segments || !Array.isArray(segments) || segments.length === 0) {
        return undefined;
      }

      // Calculate average confidence from segments
      let totalConfidence = 0;
      let validSegments = 0;

      for (const segment of segments) {
        if (typeof segment.avg_logprob === 'number') {
          // Convert log probability to confidence (approximate)
          const confidence = Math.exp(segment.avg_logprob);
          totalConfidence += confidence;
          validSegments++;
        }
      }

      if (validSegments === 0) {
        return undefined;
      }

      return totalConfidence / validSegments;
    } catch (error) {
      console.warn('⚠️ Could not calculate confidence:', error);
      return undefined;
    }
  }

  /**
   * Cancel ongoing transcription
   */
  public cancelTranscription(): void {
    console.log('🛑 Cancelling transcription...');
    
    if (this.abortController) {
      this.abortController.abort();
      this.updateProgress({
        stage: 'error',
        progress: 0,
        message: 'Transcription cancelled by user'
      });
    }
  }

  /**
   * Subscribe to progress updates
   */
  public onProgress(callback: (progress: TranscriptionProgress) => void): () => void {
    this.progressCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index > -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Update progress and notify callbacks
   */
  private updateProgress(progress: TranscriptionProgress): void {
    console.log('📊 Progress update:', progress);
    
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('❌ Error in progress callback:', error);
      }
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): SpeechToTextConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<SpeechToTextConfig>): void {
    console.log('⚙️ Updating SpeechToTextService config:', config);
    this.config = { ...this.config, ...config };
  }

  /**
   * Test connection to OpenAI API
   */
  public async testConnection(): Promise<boolean> {
    console.log('🔍 Testing OpenAI API connection...');
    
    try {
      // Create a minimal test file
      const testData = new Uint8Array(1000).fill(0); // 1KB of silence
      const testFile = new File([testData], 'test.wav', { type: 'audio/wav' });
      
      // Try to make a request (this will likely fail but we can check the error)
      await this.openai.audio.transcriptions.create({
        file: testFile,
        model: this.config.model
      });
      
      console.log('✅ OpenAI API connection test passed');
      return true;
    } catch (error) {
      console.warn('⚠️ OpenAI API connection test failed:', error);
      
      // Check if it's an authentication error vs network error
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status === 401) {
          console.error('❌ Invalid API key');
          return false;
        }
        if (status === 429) {
          console.log('✅ API key valid but rate limited');
          return true;
        }
      }
      
      return false;
    }
  }

  /**
   * Get supported languages
   */
  public getSupportedLanguages(): string[] {
    // Common languages supported by Whisper
    return [
      'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl', 'ca', 'nl', 'ar',
      'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu',
      'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa',
      'lv', 'bn', 'sr', 'az', 'sl', 'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn',
      'bs', 'kk', 'sq', 'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc',
      'ka', 'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk', 'nn',
      'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln', 'ha', 'ba', 'jw',
      'su'
    ];
  }
}

/**
 * Create a speech-to-text service instance
 */
export const createSpeechToTextService = (apiKey: string, config?: Partial<SpeechToTextConfig>): SpeechToTextService => {
  return new SpeechToTextService(apiKey, config);
}; 