// src/utils/markdown.js
// Converts simple markdown to React Native friendly segments
// Returns an array of { type, text, items } for native rendering
// On web we still use dangerouslySetInnerHTML with the HTML version

export function renderMarkdownHTML(text) {
  if (!text) return '';
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="result-card"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<strong style="font-size:0.95em">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^[•\-\*] (.+)$/gm, '<span style="display:block;padding-left:12px;margin:2px 0">· $1</span>')
    .replace(/^\d+\. (.+)$/gm, '<span style="display:block;padding-left:12px;margin:2px 0">$1</span>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.*)$/, '<p>$1</p>');
}

// Native: parse markdown into structured segments
export function parseMarkdownNative(text) {
  if (!text) return [];
  const segments = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeBlock = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        segments.push({ type: 'code', text: codeBlock.join('\n') });
        codeBlock = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBlock.push(line); continue; }

    if (line.startsWith('## '))  { segments.push({ type: 'h2',     text: line.slice(3) }); continue; }
    if (line.startsWith('### ')) { segments.push({ type: 'h3',     text: line.slice(4) }); continue; }
    if (/^[•\-\*] /.test(line)) { segments.push({ type: 'bullet', text: line.slice(2) }); continue; }
    if (/^\d+\. /.test(line))   { segments.push({ type: 'bullet', text: line.replace(/^\d+\. /, '') }); continue; }
    if (line.trim() === '')     { segments.push({ type: 'spacer' }); continue; }

    segments.push({ type: 'para', text: line });
  }

  return segments;
}

// Inline bold/italic within a line of text → returns spans array
export function parseInline(text) {
  const parts = [];
  const re = /\*\*(.*?)\*\*|\*(.*?)\*|`([^`]+)`/g;
  let last = 0;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), bold: false, italic: false, code: false });
    if (match[1] !== undefined) parts.push({ text: match[1], bold: true,   italic: false, code: false });
    if (match[2] !== undefined) parts.push({ text: match[2], bold: false,  italic: true,  code: false });
    if (match[3] !== undefined) parts.push({ text: match[3], bold: false,  italic: false, code: true  });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false, italic: false, code: false });
  return parts;
}
