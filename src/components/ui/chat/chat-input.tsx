import * as React from "react";
import { Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSubmit?: (e: React.FormEvent) => void;
  disabled?: boolean;
  showSendButton?: boolean;
  sendButtonDisabled?: boolean;
}

const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ className, onSubmit, disabled, showSendButton = true, sendButtonDisabled, ...props }, ref) => {
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (onSubmit && !disabled && !sendButtonDisabled) {
          onSubmit(e as any);
        }
      }
      // Call the original onKeyDown if provided
      if (props.onKeyDown) {
        props.onKeyDown(e);
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (onSubmit && !disabled && !sendButtonDisabled) {
        onSubmit(e);
      }
    };

    if (!showSendButton) {
      // Return original behavior if no send button needed
      return (
        <Textarea
          autoComplete="off"
          ref={ref}
          name="message"
          className={cn(
            "max-h-12 px-4 py-3 bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full rounded-md flex items-center h-16 resize-none",
            className,
          )}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          {...props}
        />
      );
    }

    return (
      <div className="relative w-full">
        <Textarea
          autoComplete="off"
          ref={ref}
          name="message"
          className={cn(
            "w-full pr-12 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 rounded-xl resize-none min-h-[44px] max-h-20",
            className,
          )}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          {...props}
        />
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={disabled || sendButtonDisabled}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 rounded-lg z-10",
            "bg-blue-500/20 hover:bg-blue-500/30 text-white border border-blue-400/30 backdrop-blur-sm",
            "transition-all duration-200 shadow-sm flex items-center justify-center",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Send className="h-4 w-4 text-black" />
        </Button>
      </div>
    );
  },
);
ChatInput.displayName = "ChatInput";

export { ChatInput };
