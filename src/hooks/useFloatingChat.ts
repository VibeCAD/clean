import { useState, useCallback } from 'react';

export interface UseFloatingChatProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  sceneInitialized: boolean;
}

export const useFloatingChat = ({ onSubmit, isLoading, sceneInitialized }: UseFloatingChatProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleSubmit = useCallback((message: string) => {
    onSubmit(message);
    // Optionally close the chat after submission
    // setIsOpen(false);
  }, [onSubmit]);

  return {
    isOpen,
    openChat,
    closeChat,
    toggleChat,
    handleSubmit,
    isLoading,
    sceneInitialized,
  };
}; 