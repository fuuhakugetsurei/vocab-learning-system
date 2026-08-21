'use client';

import React from 'react';

interface ClickableTextProps {
  text: string;
  onWordClick: (word: string) => void;
  className?: string;
}

export default function ClickableText({ text, onWordClick, className = '' }: ClickableTextProps) {
  if (!text) return null;

  // 使用正則拆分出英文單字與非英文字符
  const tokens = text.split(/([a-zA-Z]+(?:'[a-zA-Z]+)?)/g);

  return (
    <span className={className}>
      {tokens.map((token, idx) => {
        const isWord = /^[a-zA-Z]+(?:'[a-zA-Z]+)?$/.test(token);
        if (isWord) {
          return (
            <span
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                onWordClick(token);
              }}
              className="cursor-pointer hover:text-blue-600 hover:underline decoration-blue-400 decoration-2 underline-offset-2 transition-colors rounded-xs px-0.5"
              title={`點擊快速查詞: ${token}`}
            >
              {token}
            </span>
          );
        }
        return <span key={idx}>{token}</span>;
      })}
    </span>
  );
}