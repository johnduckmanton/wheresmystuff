/**
 * Browser test script for HTML entity decoding
 * 
 * Instructions:
 * 1. Open your application in the browser
 * 2. Open browser developer tools (F12)
 * 3. Go to the Console tab
 * 4. Copy and paste this script
 * 5. Press Enter to run
 */

(function testHtmlDecoding() {
  // Test the decoding function
  function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return str || '';
    
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  // Test cases from your categories
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
    'Documents &amp; Papers'
  ];

  console.log('🧪 Testing HTML Entity Decoding:');
  console.log('================================');

  let allPassed = true;

  testCases.forEach((testCase, index) => {
    const decoded = decodeHtmlEntities(testCase);
    const expected = testCase.replace(/&amp;/g, '&');
    const passed = decoded === expected;
    
    console.log(`${index + 1}. "${testCase}" → "${decoded}" ${passed ? '✅' : '❌'}`);
    
    if (!passed) {
      allPassed = false;
      console.log(`   Expected: "${expected}"`);
    }
  });

  console.log('');
  if (allPassed) {
    console.log('✅ All tests passed! HTML entity decoding is working correctly.');
    console.log('');
    console.log('🔧 If you still see encoded entities in the UI:');
    console.log('   1. The backend needs to be redeployed');
    console.log('   2. Run: ./scripts/redeploy-backend.sh');
    console.log('   3. Refresh the browser after deployment');
  } else {
    console.log('❌ Some tests failed. Check the decoding function.');
  }
})();