import { supabase } from './src/integrations/supabase/client';

async function testCategoryFilter() {
  console.log('Testing category filter via bridge...');
  try {
    const { data, error } = await supabase.functions.invoke('external-db-bridge', {
      body: {
        table: 'products',
        operation: 'select',
        select: 'id, name, category_id',
        filters: { category_id: ['00000000-0000-0000-0000-000000000000'] }, // dummy UUID
        limit: 1
      }
    });

    if (error) {
      console.error('Bridge error:', error);
    } else {
      console.log('Bridge success!', data.success);
      console.log('Records count:', data.data?.records?.length);
    }
  } catch (err) {
    console.error('Invoke failed:', err);
  }
}

testCategoryFilter();
