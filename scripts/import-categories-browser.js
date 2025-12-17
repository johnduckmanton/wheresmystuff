/**
 * Browser-based category import script
 * 
 * Instructions:
 * 1. Open your application in the browser
 * 2. Log in and select an inventory
 * 3. Open browser developer tools (F12)
 * 4. Go to the Console tab
 * 5. Copy and paste this entire script
 * 6. Press Enter to run it
 */

(async function importCategories() {
  // Categories data from household-categories.json
  const categories = [
    {
      "name": "Furniture",
      "description": "Tables, chairs, sofas, beds, wardrobes, and other furniture items",
      "color": "#8B4513",
      "icon": "chair"
    },
    {
      "name": "Electronics",
      "description": "TVs, computers, phones, tablets, gaming consoles, and electronic devices",
      "color": "#4169E1",
      "icon": "tv"
    },
    {
      "name": "Kitchen Appliances",
      "description": "Refrigerators, ovens, microwaves, dishwashers, kettles, and cooking equipment",
      "color": "#FF6347",
      "icon": "kitchen"
    },
    {
      "name": "Small Appliances",
      "description": "Toasters, blenders, coffee makers, vacuum cleaners, and portable appliances",
      "color": "#32CD32",
      "icon": "blender"
    },
    {
      "name": "Clothing & Textiles",
      "description": "Clothes, shoes, bedding, curtains, towels, and fabric items",
      "color": "#FF69B4",
      "icon": "shirt"
    },
    {
      "name": "Books & Media",
      "description": "Books, DVDs, CDs, magazines, vinyl records, and media collections",
      "color": "#8A2BE2",
      "icon": "book"
    },
    {
      "name": "Tools & Hardware",
      "description": "Hand tools, power tools, screws, nails, and DIY equipment",
      "color": "#FF8C00",
      "icon": "hammer"
    },
    {
      "name": "Garden & Outdoor",
      "description": "Garden tools, outdoor furniture, plants, pots, and gardening equipment",
      "color": "#228B22",
      "icon": "leaf"
    },
    {
      "name": "Sports & Recreation",
      "description": "Exercise equipment, sports gear, games, toys, and recreational items",
      "color": "#FF4500",
      "icon": "sports"
    },
    {
      "name": "Art & Collectibles",
      "description": "Paintings, sculptures, antiques, collectibles, and decorative items",
      "color": "#9932CC",
      "icon": "palette"
    },
    {
      "name": "Jewelry & Accessories",
      "description": "Jewelry, watches, bags, wallets, and personal accessories",
      "color": "#FFD700",
      "icon": "diamond"
    },
    {
      "name": "Musical Instruments",
      "description": "Guitars, pianos, drums, and other musical instruments and equipment",
      "color": "#DC143C",
      "icon": "music"
    },
    {
      "name": "Office & Stationery",
      "description": "Desk supplies, printers, office chairs, filing cabinets, and work equipment",
      "color": "#708090",
      "icon": "briefcase"
    },
    {
      "name": "Bathroom Items",
      "description": "Toiletries, towels, bathroom scales, and personal care items",
      "color": "#20B2AA",
      "icon": "bath"
    },
    {
      "name": "Cleaning Supplies",
      "description": "Vacuum cleaners, mops, cleaning products, and household maintenance items",
      "color": "#87CEEB",
      "icon": "spray"
    },
    {
      "name": "Lighting",
      "description": "Lamps, light fixtures, bulbs, and lighting equipment",
      "color": "#FFFF00",
      "icon": "lightbulb"
    },
    {
      "name": "Storage & Organization",
      "description": "Boxes, containers, shelving units, and organizational systems",
      "color": "#A0522D",
      "icon": "box"
    },
    {
      "name": "Automotive",
      "description": "Car accessories, tools, maintenance items, and vehicle-related equipment",
      "color": "#2F4F4F",
      "icon": "car"
    },
    {
      "name": "Pet Supplies",
      "description": "Pet food, toys, beds, carriers, and animal care items",
      "color": "#DDA0DD",
      "icon": "pets"
    },
    {
      "name": "Health & Fitness",
      "description": "Medical supplies, fitness equipment, supplements, and health monitoring devices",
      "color": "#00CED1",
      "icon": "favorite"
    },
    {
      "name": "Baby & Children",
      "description": "Baby equipment, toys, children's furniture, and childcare items",
      "color": "#FFB6C1",
      "icon": "child_care"
    },
    {
      "name": "Documents & Papers",
      "description": "Important documents, certificates, warranties, and paperwork",
      "color": "#F5F5DC",
      "icon": "description"
    },
    {
      "name": "Seasonal Items",
      "description": "Christmas decorations, holiday items, seasonal clothing, and event supplies",
      "color": "#FF1493",
      "icon": "ac_unit"
    },
    {
      "name": "Miscellaneous",
      "description": "Items that don't fit into other categories",
      "color": "#696969",
      "icon": "help_outline"
    }
  ];

  // Get the current inventory ID from the application state
  let inventoryId;
  try {
    // Try to get inventory from React context (if available)
    const inventoryContext = window.React?.useContext || null;
    if (!inventoryContext) {
      // Fallback: prompt user for inventory ID
      inventoryId = prompt('Please enter your Inventory ID:');
      if (!inventoryId) {
        console.error('Inventory ID is required');
        return;
      }
    }
  } catch (e) {
    inventoryId = prompt('Please enter your Inventory ID:');
    if (!inventoryId) {
      console.error('Inventory ID is required');
      return;
    }
  }

  // Get API URL and auth token
  const apiUrl = 'https://f5jrvv9716.execute-api.us-east-1.amazonaws.com/dev';
  
  // Try to get auth token from localStorage or sessionStorage
  let authToken;
  try {
    // Check for AWS Amplify tokens
    const cognitoKeys = Object.keys(localStorage).filter(key => 
      key.includes('CognitoIdentityServiceProvider') && key.includes('idToken')
    );
    
    if (cognitoKeys.length > 0) {
      authToken = localStorage.getItem(cognitoKeys[0]);
    }
    
    if (!authToken) {
      authToken = prompt('Please enter your JWT token (from browser dev tools > Application > Local Storage):');
      if (!authToken) {
        console.error('Auth token is required');
        return;
      }
    }
  } catch (e) {
    authToken = prompt('Please enter your JWT token:');
    if (!authToken) {
      console.error('Auth token is required');
      return;
    }
  }

  console.log(`Starting import of ${categories.length} categories...`);
  console.log(`API URL: ${apiUrl}`);
  console.log(`Inventory ID: ${inventoryId}`);
  
  const results = [];
  
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    
    try {
      console.log(`Creating: ${category.name}...`);
      
      const response = await fetch(`${apiUrl}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: category.name,
          description: category.description,
          color: category.color,
          icon: category.icon,
          inventoryId: inventoryId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✓ Created: ${category.name}`);
        results.push({ success: true, category: category.name });
      } else {
        const errorData = await response.text();
        console.log(`✗ Failed: ${category.name} (${response.status})`);
        console.log(`  Error: ${errorData}`);
        results.push({ success: false, category: category.name, error: errorData });
      }
    } catch (error) {
      console.log(`✗ Failed: ${category.name}`);
      console.log(`  Error: ${error.message}`);
      results.push({ success: false, category: category.name, error: error.message });
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n=== IMPORT SUMMARY ===');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✓ Successful: ${successful}`);
  console.log(`✗ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed categories:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.category}: ${r.error}`);
    });
  }
  
  console.log('\nImport completed!');
})();