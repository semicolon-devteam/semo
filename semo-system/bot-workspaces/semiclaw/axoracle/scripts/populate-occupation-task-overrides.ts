/**
 * Populate occupation_tasks with per-occupation time_percentage and ai_replacement_rate
 * These override the generic task-level values to reflect how each occupation differs.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Per-occupation overrides: { occupation_name_en: { task_name_en: [time_%, ai_replace_%] } }
// Values should sum to ~100% per occupation (time_percentage)
const overrides: Record<string, Record<string, [number, number]>> = {
  'Product Manager': {
    'Requirements Analysis': [20, 60],
    'User Research': [12, 45],
    'Roadmap Planning': [15, 50],
    'Data Analysis': [12, 68],
    'Market Research': [10, 62],
    'Stakeholder Management': [12, 40],
    'Documentation': [8, 72],
    'Meeting Facilitation': [5, 30],
    'Presentation': [4, 35],
    'Sprint Planning': [2, 45],
  },
  'Product Owner': {
    'Requirements Analysis': [18, 58],
    'User Research': [10, 45],
    'Roadmap Planning': [15, 48],
    'Data Analysis': [8, 65],
    'Stakeholder Management': [15, 38],
    'Documentation': [8, 70],
    'Meeting Facilitation': [8, 30],
    'Sprint Planning': [10, 42],
    'User Testing': [8, 50],
  },
  'Business Analyst': {
    'Requirements Analysis': [22, 62],
    'User Research': [8, 48],
    'Data Analysis': [25, 72],
    'Market Research': [12, 65],
    'Stakeholder Management': [10, 40],
    'Documentation': [10, 74],
    'Technical Writing': [8, 70],
    'Presentation': [5, 38],
  },
  'Technical Planner': {
    'Requirements Analysis': [15, 55],
    'Roadmap Planning': [15, 50],
    'Data Analysis': [8, 65],
    'Technology Research': [15, 52],
    'Documentation': [12, 72],
    'Technical Writing': [10, 68],
    'Code Architecture': [15, 55],
    'Sprint Planning': [10, 45],
  },
  'Product Designer': {
    'Requirements Analysis': [5, 55],
    'User Research': [15, 42],
    'UI/UX Design': [25, 72],
    'Prototyping': [15, 78],
    'User Testing': [12, 50],
    'Wireframing': [10, 75],
    'Interaction Design': [10, 62],
    'Design System Management': [5, 60],
    'Presentation': [3, 35],
  },
  'UI/UX Designer': {
    'UI/UX Design': [30, 75],
    'Prototyping': [15, 80],
    'Design System Management': [10, 65],
    'User Testing': [10, 52],
    'Visual Design': [15, 82],
    'Wireframing': [10, 72],
    'Interaction Design': [5, 65],
    'Documentation': [5, 70],
  },
  'Graphic Designer': {
    'Visual Design': [40, 88],
    'UI/UX Design': [20, 72],
    'Design System Management': [10, 62],
    'Prototyping': [15, 78],
    'Documentation': [15, 70],
  },
  'Interaction Designer': {
    'UI/UX Design': [20, 70],
    'Prototyping': [20, 78],
    'Interaction Design': [25, 65],
    'User Testing': [12, 50],
    'Wireframing': [10, 68],
    'Design System Management': [8, 60],
    'Documentation': [5, 68],
  },
  'Frontend Developer': {
    'Coding/Implementation': [35, 85],
    'Debugging': [12, 72],
    'Code Review': [8, 55],
    'Refactoring': [8, 68],
    'Test Writing': [8, 78],
    'Frontend Integration': [10, 72],
    'Performance Optimization': [5, 55],
    'Version Control': [4, 45],
    'UI/UX Design': [5, 70],
    'Package Management': [3, 68],
    'Documentation': [2, 72],
  },
  'Web Publisher': {
    'Coding/Implementation': [30, 90],
    'Frontend Integration': [20, 80],
    'UI/UX Design': [15, 75],
    'Version Control': [8, 48],
    'Package Management': [7, 72],
    'Documentation': [10, 72],
    'Performance Optimization': [10, 58],
  },
  'Mobile Developer (iOS)': {
    'Coding/Implementation': [38, 82],
    'Debugging': [12, 70],
    'Code Review': [8, 52],
    'Refactoring': [7, 65],
    'Test Writing': [8, 75],
    'Frontend Integration': [8, 70],
    'Performance Optimization': [7, 52],
    'Version Control': [4, 45],
    'Package Management': [3, 65],
    'Documentation': [5, 70],
  },
  'Mobile Developer (Android)': {
    'Coding/Implementation': [38, 82],
    'Debugging': [12, 70],
    'Code Review': [8, 52],
    'Refactoring': [7, 65],
    'Test Writing': [8, 75],
    'Frontend Integration': [8, 70],
    'Performance Optimization': [7, 52],
    'Version Control': [4, 45],
    'Package Management': [3, 65],
    'Documentation': [5, 70],
  },
  'Backend Developer': {
    'Coding/Implementation': [35, 85],
    'Debugging': [10, 72],
    'Code Review': [8, 55],
    'Refactoring': [7, 68],
    'Test Writing': [8, 78],
    'API Development': [12, 80],
    'Database Design': [7, 62],
    'Performance Optimization': [5, 55],
    'Version Control': [3, 45],
    'Package Management': [2, 68],
    'Documentation': [2, 72],
    'Technology Research': [1, 50],
  },
  'API Developer': {
    'API Development': [30, 82],
    'Coding/Implementation': [20, 85],
    'Debugging': [8, 72],
    'Code Review': [7, 55],
    'Test Writing': [8, 78],
    'Documentation': [8, 75],
    'Technical Writing': [5, 70],
    'Performance Optimization': [5, 55],
    'Version Control': [4, 45],
    'Database Design': [5, 62],
  },
  'Microservices Developer': {
    'API Development': [18, 80],
    'Coding/Implementation': [22, 85],
    'Debugging': [8, 70],
    'Code Review': [7, 55],
    'Test Writing': [7, 78],
    'Container Management': [10, 65],
    'Monitoring': [8, 68],
    'CI/CD Configuration': [7, 72],
    'Performance Optimization': [5, 55],
    'Version Control': [4, 45],
    'Documentation': [4, 72],
  },
  'Fullstack Developer': {
    'Coding/Implementation': [30, 85],
    'Debugging': [8, 72],
    'Code Review': [6, 55],
    'Refactoring': [5, 68],
    'Test Writing': [6, 78],
    'API Development': [10, 80],
    'Database Design': [5, 62],
    'Frontend Integration': [10, 72],
    'Performance Optimization': [5, 55],
    'Version Control': [4, 45],
    'Package Management': [3, 68],
    'UI/UX Design': [5, 68],
    'Documentation': [3, 72],
  },
  'QA Engineer': {
    'Test Writing': [20, 78],
    'Debugging': [10, 70],
    'User Testing': [15, 52],
    'Documentation': [10, 72],
    'Technical Writing': [8, 70],
    'Load Testing': [12, 68],
    'Automated Testing': [15, 76],
    'Meeting Facilitation': [5, 30],
    'Incident Response': [5, 45],
  },
  'Test Automation Engineer': {
    'Automated Testing': [25, 76],
    'Test Writing': [15, 78],
    'Coding/Implementation': [15, 82],
    'Debugging': [8, 70],
    'Code Review': [5, 55],
    'CI/CD Configuration': [10, 72],
    'Load Testing': [10, 68],
    'Documentation': [7, 72],
    'Version Control': [5, 45],
  },
  'Software Architect': {
    'Code Architecture': [25, 52],
    'Requirements Analysis': [12, 55],
    'Technology Research': [12, 48],
    'Database Design': [8, 58],
    'Code Review': [10, 52],
    'Documentation': [8, 70],
    'Technical Writing': [8, 68],
    'Performance Optimization': [7, 50],
    'Security Audit': [5, 55],
    'Stakeholder Management': [5, 35],
  },
  'Solutions Architect': {
    'Code Architecture': [20, 50],
    'Requirements Analysis': [12, 55],
    'Technology Research': [12, 48],
    'Infrastructure Setup': [10, 65],
    'Documentation': [10, 70],
    'Technical Writing': [8, 68],
    'Stakeholder Management': [10, 35],
    'Presentation': [8, 38],
    'Security Audit': [10, 55],
  },
  'Infrastructure Engineer': {
    'Infrastructure Setup': [20, 70],
    'Deployment': [12, 73],
    'Monitoring': [12, 68],
    'CI/CD Configuration': [10, 73],
    'Container Management': [10, 65],
    'Incident Response': [12, 45],
    'Capacity Planning': [8, 58],
    'Backup Management': [6, 68],
    'Documentation': [5, 72],
    'Version Control': [5, 45],
  },
  'DevOps Engineer': {
    'Deployment': [12, 75],
    'CI/CD Configuration': [15, 75],
    'Infrastructure Setup': [12, 70],
    'Monitoring': [10, 68],
    'Container Management': [10, 65],
    'Incident Response': [10, 45],
    'Log Analysis': [5, 65],
    'Capacity Planning': [5, 58],
    'Backup Management': [4, 68],
    'Automated Testing': [7, 75],
    'Documentation': [5, 72],
    'Version Control': [5, 45],
  },
  'Site Reliability Engineer (SRE)': {
    'Monitoring': [15, 70],
    'Incident Response': [18, 42],
    'Capacity Planning': [10, 55],
    'Performance Optimization': [10, 52],
    'Deployment': [8, 73],
    'CI/CD Configuration': [8, 73],
    'Log Analysis': [8, 65],
    'Infrastructure Setup': [7, 68],
    'Incident Postmortem': [6, 48],
    'Documentation': [5, 72],
    'Automated Testing': [5, 75],
  },
  'Cloud Engineer': {
    'Infrastructure Setup': [18, 72],
    'Deployment': [10, 75],
    'Monitoring': [10, 68],
    'Capacity Planning': [10, 58],
    'Container Management': [10, 65],
    'CI/CD Configuration': [10, 73],
    'Backup Management': [8, 68],
    'Security Audit': [8, 58],
    'Performance Optimization': [6, 55],
    'Documentation': [5, 72],
    'Version Control': [5, 45],
  },
  'Data Engineer': {
    'Coding/Implementation': [20, 82],
    'Database Design': [15, 60],
    'Data Migration': [12, 65],
    'Data Analysis': [10, 68],
    'Performance Optimization': [10, 52],
    'Monitoring': [8, 68],
    'Deployment': [8, 73],
    'CI/CD Configuration': [7, 73],
    'Documentation': [5, 72],
    'Version Control': [5, 45],
  },
  'Data Analyst': {
    'Data Analysis': [35, 72],
    'Requirements Analysis': [10, 58],
    'Market Research': [12, 65],
    'Documentation': [10, 72],
    'Technical Writing': [8, 70],
    'Presentation': [12, 42],
    'Stakeholder Management': [13, 38],
  },
  'ML Engineer': {
    'Coding/Implementation': [25, 80],
    'Data Analysis': [15, 68],
    'Technology Research': [12, 48],
    'Performance Optimization': [8, 50],
    'Monitoring': [8, 65],
    'Deployment': [8, 72],
    'Documentation': [5, 70],
    'Version Control': [4, 45],
    'Test Writing': [8, 75],
    'Debugging': [7, 68],
  },
  'Database Administrator (DBA)': {
    'Database Design': [15, 58],
    'Data Migration': [10, 65],
    'Backup Management': [12, 70],
    'Monitoring': [15, 68],
    'Performance Optimization': [15, 52],
    'Security Audit': [8, 58],
    'Capacity Planning': [8, 55],
    'Incident Response': [8, 42],
    'Documentation': [5, 70],
    'Access Control': [4, 62],
  },
  'Security Engineer': {
    'Security Audit': [18, 58],
    'Penetration Testing': [15, 50],
    'Security Monitoring': [12, 70],
    'Access Control': [8, 62],
    'Compliance Management': [10, 55],
    'Incident Response': [12, 42],
    'Documentation': [8, 72],
    'Technical Writing': [7, 68],
    'Code Review': [10, 52],
  },
  'Security Analyst': {
    'Security Audit': [15, 60],
    'Security Monitoring': [20, 72],
    'Access Control': [8, 62],
    'Compliance Management': [12, 55],
    'Incident Response': [12, 45],
    'Log Analysis': [12, 65],
    'Documentation': [12, 72],
    'Technical Writing': [9, 68],
  },
};

async function populate() {
  console.log('🚀 Populating occupation_tasks overrides...\n');

  // Fetch lookups
  const { data: occupations } = await supabase.from('occupations').select('id, name_en').eq('country', 'KR');
  const { data: tasks } = await supabase.from('tasks').select('id, name_en');

  const occMap = new Map(occupations?.map(o => [o.name_en, o.id]) || []);
  const taskMap = new Map(tasks?.map(t => [t.name_en, t.id]) || []);

  // For each occupation (KR only - US and JP share same name_en so we update all)
  let updated = 0;
  let errors = 0;

  for (const [occName, taskOverrides] of Object.entries(overrides)) {
    // Get all occupation rows with this name_en (KR, US, JP)
    const { data: occRows } = await supabase
      .from('occupations')
      .select('id')
      .eq('name_en', occName);

    if (!occRows || occRows.length === 0) {
      console.warn(`⚠️  Occupation not found: ${occName}`);
      continue;
    }

    for (const occ of occRows) {
      for (const [taskName, [timePct, aiRate]] of Object.entries(taskOverrides)) {
        const taskId = taskMap.get(taskName);
        if (!taskId) {
          console.warn(`⚠️  Task not found: ${taskName}`);
          continue;
        }

        const { error } = await supabase
          .from('occupation_tasks')
          .update({ time_percentage: timePct, ai_replacement_rate: aiRate })
          .eq('occupation_id', occ.id)
          .eq('task_id', taskId);

        if (error) {
          console.error(`❌ ${occName} → ${taskName}: ${error.message}`);
          errors++;
        } else {
          updated++;
        }
      }
    }
    console.log(`✓ ${occName} (${Object.keys(taskOverrides).length} tasks)`);
  }

  console.log(`\n✅ Done! Updated: ${updated}, Errors: ${errors}`);

  // Verify
  const { count } = await supabase
    .from('occupation_tasks')
    .select('*', { count: 'exact', head: true })
    .not('time_percentage', 'is', null);
  console.log(`📊 Rows with overrides: ${count}`);
}

populate().catch(e => { console.error(e); process.exit(1); });
