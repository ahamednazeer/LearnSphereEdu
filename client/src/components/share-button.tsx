import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Share2, Link, Copy, ExternalLink } from "lucide-react";

interface ShareButtonProps {
  title: string;
  url?: string;
  description?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function ShareButton({ 
  title, 
  url = window.location.href, 
  description = "",
  variant = "outline",
  size = "sm",
  className = ""
}: ShareButtonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link copied!",
        description: "The link has been copied to your clipboard.",
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Failed to copy link",
        description: "Please try again or copy the URL manually.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        });
        setIsOpen(false);
      } catch (error) {
        // User cancelled sharing or error occurred
        if ((error as Error).name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const shareToSocial = (platform: string) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);
    
    let shareUrl = "";
    
    switch (platform) {
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
        break;
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case "linkedin":
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        break;
      case "email":
        shareUrl = `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=400");
      setIsOpen(false);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={`flex items-center gap-2 ${className}`}>
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleShare} className="flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} className="flex items-center gap-2">
          <Copy className="w-4 h-4" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareToSocial("email")} className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareToSocial("twitter")} className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareToSocial("facebook")} className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareToSocial("linkedin")} className="flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          LinkedIn
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}