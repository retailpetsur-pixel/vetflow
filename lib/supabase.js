import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://imkwtzatxykmkvlfpepi.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlta3d0emF0eHlrbWt2bGZwZXBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzUwNjQsImV4cCI6MjA5MDA1MTA2NH0.HdM8VbQC7QZOq3CRH-4BDMQoJzB6ZBE-ta1R5dsRkUo'

export const supabase = createClient(supabaseUrl, supabaseKey)