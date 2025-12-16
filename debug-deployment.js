#!/usr/bin/env node

/**
 * Debug script to check deployment status
 */

const { CloudFormationClient, DescribeStacksCommand, ListStacksCommand } = require('@aws-sdk/client-cloudformation');
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const cfClient = new CloudFormationClient({});
const dbClient = new DynamoDBClient({});

async function checkDeployment() {
  console.log('🔍 Checking deployment status...\n');
  
  // Check CloudFormation stacks
  try {
    console.log('📋 Checking CloudFormation stacks...');
    const stacks = await cfClient.send(new ListStacksCommand({
      StackStatusFilter: ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'CREATE_IN_PROGRESS', 'UPDATE_IN_PROGRESS']
    }));
    
    const inventoryStacks = stacks.StackSummaries.filter(stack => 
      stack.StackName.includes('inventory') || stack.StackName.includes('home')
    );
    
    if (inventoryStacks.length === 0) {
      console.log('❌ No inventory-related stacks found');
      console.log('Available stacks:');
      stacks.StackSummaries.forEach(stack => {
        console.log(`  - ${stack.StackName}: ${stack.StackStatus}`);
      });
    } else {
      console.log('✅ Found inventory stacks:');
      inventoryStacks.forEach(stack => {
        console.log(`  - ${stack.StackName}: ${stack.StackStatus}`);
      });
      
      // Get detailed info about the main stack
      try {
        const stackDetails = await cfClient.send(new DescribeStacksCommand({
          StackName: 'home-inventory-system'
        }));
        
        const stack = stackDetails.Stacks[0];
        console.log(`\n📊 Stack Details for ${stack.StackName}:`);
        console.log(`  Status: ${stack.StackStatus}`);
        console.log(`  Created: ${stack.CreationTime}`);
        
        if (stack.Outputs) {
          console.log('\n📤 Stack Outputs:');
          stack.Outputs.forEach(output => {
            console.log(`  ${output.OutputKey}: ${output.OutputValue}`);
          });
        }
        
      } catch (error) {
        console.log(`❌ Error getting stack details: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Error checking stacks: ${error.message}`);
  }
  
  // Check DynamoDB tables
  try {
    console.log('\n🗄️  Checking DynamoDB tables...');
    const tables = await dbClient.send(new ListTablesCommand({}));
    
    if (tables.TableNames.length === 0) {
      console.log('❌ No DynamoDB tables found');
    } else {
      console.log('📋 Available tables:');
      tables.TableNames.forEach(name => {
        if (name.includes('inventory') || name.includes('home')) {
          console.log(`  ✅ ${name} (inventory-related)`);
        } else {
          console.log(`  - ${name}`);
        }
      });
    }
    
  } catch (error) {
    console.log(`❌ Error checking tables: ${error.message}`);
  }
  
  console.log('\n🎯 Diagnosis:');
  console.log('If no tables exist, the CloudFormation deployment may have failed silently');
  console.log('or the stack may not have been created properly.');
  console.log('\nNext steps:');
  console.log('1. Check if the stack exists in CloudFormation console');
  console.log('2. If stack exists but no table, check stack events for errors');
  console.log('3. If no stack exists, redeploy with: sam deploy --guided');
}

checkDeployment().catch(console.error);