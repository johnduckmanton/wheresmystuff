#!/usr/bin/env node

/**
 * Test script to verify HTML entity decoding is working
 */

// Test the decoding function
function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

// Test cases
const testCases = [
  'Tools &amp; Hardware',
  'Books &amp; Media',
  'Art &amp; Collectibles',
  'Health &amp; Fitness',
  'Baby &amp; Children',
  'Garden &amp; Outdoor',
  'Sports &amp; Recreation',
  'Storage &amp; Organization',
  'Clothing &amp; Textiles',
  'Jewelry &amp; Accessories',
  'Office &amp; Stationery',
  'Kitchen &amp; Dining',
  'Home &amp; Garden',
  'Electronics &amp; Technology'
];

console.log('Testing HTML Entity Decoding:');
console.log('============================');

testCases.forEach((testCase, index) => {
  const decoded = decodeHtmlEntities(testCase);
  console.log(`${index + 1}. "${testCase}" → "${decoded}"`);
});

console.log('\nAll tests completed!');
console.log('If you see "&amp;" converted to "&", the decoding is working correctly.');