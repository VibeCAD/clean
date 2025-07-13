/**
 * Audio Recording Service
 * 
 * This service handles all audio recording functionality including:
 * - Microphone permission management
 * - MediaRecorder API integration
 * - WebM format support with fallback
 * - Recording state management
 * - Audio blob processing
 * - Error handling and logging
 */

export interface AudioRecordingConfig {
  maxDuration: number; // Maximum recording duration in milliseconds
  maxFileSize: number; // Maximum file size in bytes
  mimeType: string; // Preferred MIME type
  sampleRate?: number; // Sample rate in Hz
  channels?: number; // Number of audio channels
  bitRate?: number; // Bit rate in bits per second
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // Current recording duration in seconds
  hasPermission: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
  audioLevel: number; // Audio level for visualization (0-1)
  error: string | null;
  isProcessing: boolean;
}

export interface AudioRecordingResult {
  blob: Blob;
  duration: number;
  size: number;
  mimeType: string;
  url: string; // Object URL for the blob
}

export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private durationInterval: NodeJS.Timeout | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame: number | null = null;
  
  private config: AudioRecordingConfig = {
    maxDuration: 60000, // 60 seconds
    maxFileSize: 25 * 1024 * 1024, // 25MB (Whisper limit)
    mimeType: 'audio/webm;codecs=opus',
    sampleRate: 16000, // Optimal for Whisper
    channels: 1, // Mono for speech
    bitRate: 64000 // 64kbps for speech
  };

  private state: RecordingState = {
    isRecording: false,
    isPaused: false,
    duration: 0,
    hasPermission: false,
    permissionStatus: 'unknown',
    audioLevel: 0,
    error: null,
    isProcessing: false
  };

  private stateChangeCallbacks: ((state: RecordingState) => void)[] = [];

  constructor(config?: Partial<AudioRecordingConfig>) {
    console.log('🎙️ Initializing AudioRecordingService');
    
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.checkBrowserSupport();
    this.checkExistingPermission();
    
    console.log('🎙️ AudioRecordingService initialized with config:', this.config);
  }

  /**
   * Check if the browser supports the required audio recording features
   */
  private checkBrowserSupport(): void {
    console.log('🔍 Checking browser support for audio recording...');
    
    const support = {
      mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      mediaRecorder: !!window.MediaRecorder,
      audioContext: !!(window.AudioContext || (window as any).webkitAudioContext),
      webm: MediaRecorder.isTypeSupported('audio/webm;codecs=opus'),
      mp3: MediaRecorder.isTypeSupported('audio/mpeg'),
      wav: MediaRecorder.isTypeSupported('audio/wav')
    };

    console.log('🔍 Browser support check:', support);

    if (!support.mediaDevices) {
      throw new Error('getUserMedia is not supported in this browser');
    }

    if (!support.mediaRecorder) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Choose the best available format
    if (support.webm) {
      this.config.mimeType = 'audio/webm;codecs=opus';
      console.log('✅ Using WebM format with Opus codec');
    } else if (support.mp3) {
      this.config.mimeType = 'audio/mpeg';
      console.log('✅ Falling back to MP3 format');
    } else if (support.wav) {
      this.config.mimeType = 'audio/wav';
      console.log('✅ Falling back to WAV format');
    } else {
      throw new Error('No supported audio format available');
    }
  }

  /**
   * Check existing microphone permission status
   */
  private async checkExistingPermission(): Promise<void> {
    console.log('🔍 Checking existing microphone permissions...');
    
    try {
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        this.state.permissionStatus = permission.state;
        this.state.hasPermission = permission.state === 'granted';
        
        console.log('🔍 Permission status:', permission.state);
        
        // Listen for permission changes
        permission.onchange = () => {
          console.log('🔄 Permission status changed:', permission.state);
          this.state.permissionStatus = permission.state;
          this.state.hasPermission = permission.state === 'granted';
          this.notifyStateChange();
        };
      } else {
        console.log('⚠️ Permissions API not supported, will check on first use');
        this.state.permissionStatus = 'unknown';
      }
    } catch (error) {
      console.warn('⚠️ Could not check microphone permissions:', error);
      this.state.permissionStatus = 'unknown';
    }
  }

  /**
   * Request microphone permission and set up audio stream
   */
  public async requestPermission(): Promise<boolean> {
    console.log('🎤 Requesting microphone permission...');
    
    try {
      this.state.error = null;
      this.state.isProcessing = true;
      this.notifyStateChange();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('✅ Microphone permission granted');
      this.state.hasPermission = true;
      this.state.permissionStatus = 'granted';
      this.state.isProcessing = false;
      
      // Store the stream for later use
      this.mediaStream = stream;
      
      this.notifyStateChange();
      return true;
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      this.state.hasPermission = false;
      this.state.permissionStatus = 'denied';
      this.state.error = error instanceof Error ? error.message : 'Permission denied';
      this.state.isProcessing = false;
      this.notifyStateChange();
      return false;
    }
  }

  /**
   * Start recording audio
   */
  public async startRecording(): Promise<void> {
    console.log('🎙️ Starting audio recording...');

    if (this.state.isRecording) {
      console.log('⚠️ Recording already in progress');
      return;
    }

    try {
      // Request permission if not already granted
      if (!this.state.hasPermission) {
        const granted = await this.requestPermission();
        if (!granted) {
          throw new Error('Microphone permission required');
        }
      }

      // If we don't have a stream, request it
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: this.config.sampleRate,
            channelCount: this.config.channels,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: this.config.mimeType,
        audioBitsPerSecond: this.config.bitRate
      });

      // Clear previous chunks
      this.audioChunks = [];

      // Set up event listeners
      this.setupMediaRecorderEvents();

      // Set up audio visualization
      this.setupAudioVisualization();

      // Start recording
      this.mediaRecorder.start();
      this.startTime = Date.now();
      this.state.isRecording = true;
      this.state.duration = 0;
      this.state.error = null;

      // Start duration tracking
      this.durationInterval = setInterval(() => {
        this.state.duration = (Date.now() - this.startTime) / 1000;
        this.notifyStateChange();

        // Auto-stop if max duration reached
        if (this.state.duration >= this.config.maxDuration / 1000) {
          console.log('⏱️ Maximum recording duration reached, stopping...');
          this.stopRecording();
        }
      }, 100);

      console.log('✅ Recording started successfully');
      this.notifyStateChange();
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      this.state.error = error instanceof Error ? error.message : 'Failed to start recording';
      this.state.isRecording = false;
      this.notifyStateChange();
      throw error;
    }
  }

  /**
   * Stop recording audio
   */
  public async stopRecording(): Promise<AudioRecordingResult | null> {
    console.log('🛑 Stopping audio recording...');

    if (!this.state.isRecording || !this.mediaRecorder) {
      console.log('⚠️ No recording in progress');
      return null;
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No MediaRecorder available'));
        return;
      }

      // Set up one-time event listener for when recording stops
      this.mediaRecorder.addEventListener('stop', () => {
        console.log('🎯 MediaRecorder stopped, processing audio...');
        this.processRecording()
          .then(resolve)
          .catch(reject);
      }, { once: true });

      // Stop the recorder
      this.mediaRecorder.stop();
      this.state.isRecording = false;

      // Clear duration interval
      if (this.durationInterval) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }

      // Stop audio visualization
      this.stopAudioVisualization();

      console.log('✅ Recording stopped, processing...');
      this.notifyStateChange();
    });
  }

  /**
   * Toggle recording on/off
   */
  public async toggleRecording(): Promise<AudioRecordingResult | null> {
    console.log('🔄 Toggling recording state...');
    
    if (this.state.isRecording) {
      return await this.stopRecording();
    } else {
      await this.startRecording();
      return null;
    }
  }

  /**
   * Set up MediaRecorder event listeners
   */
  private setupMediaRecorderEvents(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      console.log('📦 Audio data available:', event.data.size, 'bytes');
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    });

    this.mediaRecorder.addEventListener('error', (event) => {
      console.error('❌ MediaRecorder error:', event);
      this.state.error = 'Recording error occurred';
      this.state.isRecording = false;
      this.notifyStateChange();
    });
  }

  /**
   * Set up audio visualization
   */
  private setupAudioVisualization(): void {
    if (!this.mediaStream) return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);
      
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioLevel = () => {
        if (!this.analyser || !this.state.isRecording) return;
        
        this.analyser.getByteFrequencyData(dataArray);
        
        // Calculate average audio level
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        
        this.state.audioLevel = sum / bufferLength / 255;
        this.notifyStateChange();
        
        this.animationFrame = requestAnimationFrame(updateAudioLevel);
      };
      
      updateAudioLevel();
      console.log('🎨 Audio visualization set up');
    } catch (error) {
      console.warn('⚠️ Could not set up audio visualization:', error);
    }
  }

  /**
   * Stop audio visualization
   */
  private stopAudioVisualization(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.state.audioLevel = 0;
    
    console.log('🎨 Audio visualization stopped');
  }

  /**
   * Process the recorded audio chunks into a result
   */
  private async processRecording(): Promise<AudioRecordingResult> {
    console.log('⚙️ Processing recorded audio chunks...');
    
    if (this.audioChunks.length === 0) {
      throw new Error('No audio data recorded');
    }

    const blob = new Blob(this.audioChunks, { type: this.config.mimeType });
    const duration = this.state.duration;
    const size = blob.size;
    const url = URL.createObjectURL(blob);

    console.log('📊 Recording processed:', {
      duration: `${duration.toFixed(2)}s`,
      size: `${(size / 1024).toFixed(2)}KB`,
      mimeType: this.config.mimeType,
      chunks: this.audioChunks.length
    });

    // Check file size limit
    if (size > this.config.maxFileSize) {
      console.warn('⚠️ Recording exceeds size limit:', size, 'bytes');
      URL.revokeObjectURL(url);
      throw new Error(`Recording too large: ${(size / 1024 / 1024).toFixed(2)}MB (max: ${this.config.maxFileSize / 1024 / 1024}MB)`);
    }

    const result: AudioRecordingResult = {
      blob,
      duration,
      size,
      mimeType: this.config.mimeType,
      url
    };

    // Clear chunks
    this.audioChunks = [];

    console.log('✅ Recording processing complete');
    return result;
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    console.log('🧹 Cleaning up AudioRecordingService...');

    if (this.state.isRecording) {
      this.stopRecording();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped media track:', track.kind);
      });
      this.mediaStream = null;
    }

    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    this.stopAudioVisualization();
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stateChangeCallbacks = [];

    console.log('✅ AudioRecordingService cleanup complete');
  }

  /**
   * Subscribe to state changes
   */
  public onStateChange(callback: (state: RecordingState) => void): () => void {
    this.stateChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of state changes
   */
  private notifyStateChange(): void {
    const currentState = { ...this.state };
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(currentState);
      } catch (error) {
        console.error('❌ Error in state change callback:', error);
      }
    });
  }

  /**
   * Get current recording state
   */
  public getState(): RecordingState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  public getConfig(): AudioRecordingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<AudioRecordingConfig>): void {
    console.log('⚙️ Updating AudioRecordingService config:', config);
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a singleton instance of the audio recording service
 */
let audioRecordingServiceInstance: AudioRecordingService | null = null;

export const createAudioRecordingService = (config?: Partial<AudioRecordingConfig>): AudioRecordingService => {
  if (!audioRecordingServiceInstance) {
    audioRecordingServiceInstance = new AudioRecordingService(config);
  }
  return audioRecordingServiceInstance;
};

export const getAudioRecordingService = (): AudioRecordingService | null => {
  return audioRecordingServiceInstance;
}; 