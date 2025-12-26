/**
 * Debug script to check category data in the browser
 * 
 * Instructions:
 * 1. Open your application in the browser
 * 2. Go to the Categories page
 * 3. Open browser developer tools (F12)
 * 4. Go to the Console tab
 * 5. Copy and paste this script
 * 6. Press Enter to run
 */

(async function debugCategories() {
  console.log('🔍 Debugging Categories Data...');
  console.log('===============================');

  // Try to get categories from the API
  try {
    // Get the API URL from the environment
    const apiUrl = 'https://f5jrvv9716.execute-api.eu-west-1.amazonaws.com/dev';
    
    // Try to get auth token from localStorage
    let authToken;
    const cognitoKeys = Object.keys(localStorage).filter(key => 
      key.includes('CognitoIdentityServiceProvider') && key.includes('idToken')
    );
    
    if (cognitoKeys.length > 0) {
      authToken = localStorage.getItem(cognitoKeys[0]);
    }
    
    if (!authToken) {
      console.log('❌ No auth token found. Please log in first.');
      return;
    }

    // Get inventory ID (you'll need to replace this)
    const inventoryId = prompt('Enter your Inventory ID:');
    if (!inventoryId) {
      console.log('❌ Inventory ID required');
      return;
    }

    console.log(`📡 Fetching categories for inventory: ${inventoryId}`);
    
    const response = await fetch(`${apiUrl}/categories?inventoryId=${inventoryId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    const categories = data.data || data;

    console.log(`✅ Found ${categories.length} categories:`);
    console.log('');

    categories.forEach((category, index) => {
      console.log(`${index + 1}. ${category.name}`);
      console.log(`   Description: ${category.description || 'None'}`);
      console.log(`   Color: ${category.color || 'NOT SET'}`);
      console.log(`   Icon: ${category.icon || 'NOT SET'}`);
      console.log(`   ID: ${category.id}`);
      console.log('');
    });

    // Check for missing colors/icons
    const missingColor = categories.filter(c => !c.color);
    const missingIcon = categories.filter(c => !c.icon);

    if (missingColor.length > 0) {
      console.log(`⚠️  ${missingColor.length} categories missing colors:`);
      missingColor.forEach(c => console.log(`   - ${c.name}`));
      console.log('');
    }

    if (missingIcon.length > 0) {
      console.log(`⚠️  ${missingIcon.length} categories missing icons:`);
      missingIcon.forEach(c => console.log(`   - ${c.name}`));
      console.log('');
    }

    if (missingColor.length === 0 && missingIcon.length === 0) {
      console.log('✅ All categories have colors and icons!');
    }

  } catch (error) {
    console.error('❌ Error fetching categories:', error);
  }
})();