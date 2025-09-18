// Test script to verify metadata extraction functionality
import { extractTextMetadata, extractContentMetadata } from './server/video-utils.ts';

// Test text content metadata extraction
console.log('Testing text metadata extraction...');
const sampleText = `
<h1>Introduction to JavaScript</h1>
<p>JavaScript is a versatile programming language that powers the web. In this comprehensive lesson, we'll explore the fundamentals of JavaScript programming.</p>
<p>You'll learn about variables, functions, objects, and much more. This content is designed to give you a solid foundation in JavaScript development.</p>
<h2>What You'll Learn</h2>
<ul>
<li>Variables and data types</li>
<li>Functions and scope</li>
<li>Objects and arrays</li>
<li>DOM manipulation</li>
<li>Event handling</li>
</ul>
<p>By the end of this lesson, you'll have a strong understanding of JavaScript basics and be ready to build interactive web applications.</p>
`;

const textMetadata = extractTextMetadata(sampleText, 'javascript-intro.html');
console.log('Text Metadata:', {
  fileName: textMetadata.fileName,
  fileSize: textMetadata.fileSize,
  wordCount: textMetadata.wordCount,
  readingTime: textMetadata.readingTime,
  duration: textMetadata.duration,
  mimeType: textMetadata.mimeType,
  fileHash: textMetadata.fileHash?.substring(0, 16) + '...'
});

console.log('\nFormatted reading time:', Math.floor(textMetadata.readingTime / 60) + ':' + (textMetadata.readingTime % 60).toString().padStart(2, '0'));

console.log('\nMetadata extraction test completed successfully!');