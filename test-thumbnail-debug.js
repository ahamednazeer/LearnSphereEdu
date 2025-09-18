import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Open the database
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Testing thumbnail data...\n');

// Check courses with cover images
db.all("SELECT id, title, cover_image FROM courses WHERE cover_image IS NOT NULL", (err, rows) => {
  if (err) {
    console.error('Error querying courses:', err);
    return;
  }
  
  console.log('Courses with cover images:');
  rows.forEach(row => {
    console.log(`- ID: ${row.id}`);
    console.log(`  Title: ${row.title}`);
    console.log(`  Cover Image: ${row.cover_image}`);
    console.log('');
  });
  
  // Check if thumbnail files exist
  const thumbnailDir = path.join(__dirname, 'uploads', 'thumbnails');
  
  console.log('Checking thumbnail directory:', thumbnailDir);
  
  if (fs.existsSync(thumbnailDir)) {
    const files = fs.readdirSync(thumbnailDir);
    console.log('Thumbnail files found:', files);
    
    // Check if the specific thumbnail exists
    rows.forEach(row => {
      if (row.cover_image) {
        const filename = row.cover_image.replace('/uploads/thumbnails/', '');
        const filePath = path.join(thumbnailDir, filename);
        const exists = fs.existsSync(filePath);
        console.log(`Thumbnail ${filename} exists: ${exists}`);
        if (exists) {
          const stats = fs.statSync(filePath);
          console.log(`  Size: ${stats.size} bytes`);
        }
      }
    });
  } else {
    console.log('Thumbnail directory does not exist!');
  }
  
  db.close();
});