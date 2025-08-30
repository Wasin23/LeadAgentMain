import { internetSearch } from './tools/internetSearch.js';

async function testSearch() {
  console.log('Testing internet search tool...');
  try {
    const result = await internetSearch('latest AI news');
    console.log('Search result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Search error:', error);
  }
}

testSearch();
