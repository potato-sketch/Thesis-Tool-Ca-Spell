import React, { useState, useEffect } from "react";

export default function TextType({
  text = [],
  typingSpeed = 50,
  pauseDuration = 2000,
  deletingSpeed = 30,
  loop = true,
  showCursor = true,
}) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Ensure text is an array
  const texts = Array.isArray(text) ? text : [text];

  useEffect(() => {
    if (texts.length === 0) return;

    const fullText = texts[currentTextIndex];
    let timer;

    if (!isDeleting) {
      // Typing characters
      if (displayedText.length < fullText.length) {
        timer = setTimeout(() => {
          setDisplayedText(fullText.substring(0, displayedText.length + 1));
        }, typingSpeed);
      } else {
        // Pause at the end of typing before deleting
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, pauseDuration);
      }
    } else {
      // Deleting characters
      if (displayedText.length > 0) {
        timer = setTimeout(() => {
          setDisplayedText(fullText.substring(0, displayedText.length - 1));
        }, deletingSpeed);
      } else {
        setIsDeleting(false);
        // Move to the next text string
        if (currentTextIndex < texts.length - 1) {
          setCurrentTextIndex(currentTextIndex + 1);
        } else if (loop) {
          setCurrentTextIndex(0);
        }
      }
    }

    return () => clearTimeout(timer);
  }, [
    displayedText,
    isDeleting,
    currentTextIndex,
    texts,
    typingSpeed,
    pauseDuration,
    deletingSpeed,
    loop,
  ]);

  return (
    <span>
      {displayedText}
      {showCursor && (
        <span className="animate-pulse ml-0.5 inline-block w-1 bg-current">
          |
        </span>
      )}
    </span>
  );
}
