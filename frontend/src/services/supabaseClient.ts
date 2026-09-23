import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://obcxpsriultifppkskax.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY3hwc3JpdWx0aWZwcGtza2F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2ODAyMjgsImV4cCI6MjEwNDI1NjIyOH0.bbzfjZybyx4Bt0Y5quu8K7AZY_URdWQIebn2pN8XcGw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
