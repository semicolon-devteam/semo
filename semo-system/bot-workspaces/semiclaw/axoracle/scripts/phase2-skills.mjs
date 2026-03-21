/**
 * Phase 2 Step 2: Add non-IT specific skills + task_skills mappings
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NON_IT_SKILLS = [
  // Language & Communication
  { name_en: 'Bilingual Fluency', name_ko: '이중언어 능숙도', name_ja: 'バイリンガル能力', category: 'language', ai_vulnerability: 75, ai_augmentation: 85, future_demand: 'declining', description_en: 'Native-level proficiency in two or more languages', description_ko: '두 가지 이상 언어에 대한 원어민 수준의 능숙도', description_ja: '2つ以上の言語でのネイティブレベルの熟達度' },
  { name_en: 'Cultural Sensitivity', name_ko: '문화적 감수성', name_ja: '文化的感受性', category: 'interpersonal', ai_vulnerability: 20, ai_augmentation: 40, future_demand: 'rising', description_en: 'Understanding cultural nuances that affect communication and business', description_ko: '의사소통과 비즈니스에 영향을 미치는 문화적 뉘앙스 이해', description_ja: 'コミュニケーションとビジネスに影響する文化的ニュアンスの理解' },
  { name_en: 'Persuasive Writing', name_ko: '설득적 글쓰기', name_ja: '説得力のあるライティング', category: 'creative', ai_vulnerability: 65, ai_augmentation: 80, future_demand: 'stable', description_en: 'Crafting compelling narratives that drive action', description_ko: '행동을 유도하는 설득력 있는 서사 작성', description_ja: '行動を促す説得力のある文章の作成' },
  { name_en: 'Investigative Journalism', name_ko: '탐사보도 역량', name_ja: '調査報道能力', category: 'analytical', ai_vulnerability: 25, ai_augmentation: 60, future_demand: 'stable', description_en: 'Deep research, source cultivation, and uncovering hidden information', description_ko: '심층 조사, 취재원 관리 및 숨겨진 정보 발굴', description_ja: '深い調査、情報源の開拓、隠された情報の発掘' },
  
  // Creative & Artistic
  { name_en: 'Visual Artistry', name_ko: '시각 예술 감각', name_ja: 'ビジュアルアートセンス', category: 'creative', ai_vulnerability: 55, ai_augmentation: 75, future_demand: 'stable', description_en: 'Artistic eye for composition, color theory, and visual storytelling', description_ko: '구도, 색채 이론 및 시각적 스토리텔링에 대한 예술적 감각', description_ja: '構図、色彩理論、ビジュアルストーリーテリングの芸術的感覚' },
  { name_en: 'Motion Graphics', name_ko: '모션 그래픽스', name_ja: 'モーショングラフィックス', category: 'technical', ai_vulnerability: 65, ai_augmentation: 80, future_demand: 'rising', description_en: 'Creating animated visual content for video and digital media', description_ko: '영상 및 디지털 미디어용 애니메이션 시각 콘텐츠 제작', description_ja: '映像とデジタルメディア用のアニメーションビジュアルコンテンツ制作' },
  { name_en: 'Photography Technique', name_ko: '촬영 기법', name_ja: '撮影技術', category: 'technical', ai_vulnerability: 20, ai_augmentation: 50, future_demand: 'stable', description_en: 'Technical mastery of lighting, exposure, and camera equipment', description_ko: '조명, 노출 및 카메라 장비에 대한 기술적 숙달', description_ja: 'ライティング、露出、カメラ機材の技術的習熟' },
  
  // Financial & Legal
  { name_en: 'Financial Accounting', name_ko: '재무회계', name_ja: '財務会計', category: 'analytical', ai_vulnerability: 70, ai_augmentation: 85, future_demand: 'stable', description_en: 'Knowledge of accounting standards, financial statements, and auditing', description_ko: '회계 기준, 재무제표 및 감사에 대한 지식', description_ja: '会計基準、財務諸表、監査に関する知識' },
  { name_en: 'Tax Law Expertise', name_ko: '세법 전문 지식', name_ja: '税法の専門知識', category: 'analytical', ai_vulnerability: 60, ai_augmentation: 80, future_demand: 'stable', description_en: 'Deep understanding of tax codes, deductions, and compliance requirements', description_ko: '세법, 공제 및 컴플라이언스 요건에 대한 깊은 이해', description_ja: '税法、控除、コンプライアンス要件の深い理解' },
  { name_en: 'Legal Reasoning', name_ko: '법적 추론', name_ja: '法的推論', category: 'analytical', ai_vulnerability: 40, ai_augmentation: 70, future_demand: 'stable', description_en: 'Applying legal principles to analyze cases and construct arguments', description_ko: '법적 원칙을 적용하여 사건 분석 및 논증 구성', description_ja: '法的原則を適用して事案を分析し論証を構成' },
  { name_en: 'Courtroom Advocacy', name_ko: '법정 변론 능력', name_ja: '法廷弁論能力', category: 'interpersonal', ai_vulnerability: 15, ai_augmentation: 30, future_demand: 'stable', description_en: 'Oral argumentation and persuasion in legal proceedings', description_ko: '법적 절차에서의 구두 논증 및 설득', description_ja: '法的手続きにおける口頭論証と説得' },
  { name_en: 'Risk Assessment', name_ko: '리스크 평가', name_ja: 'リスク評価', category: 'analytical', ai_vulnerability: 60, ai_augmentation: 80, future_demand: 'rising', description_en: 'Evaluating financial, insurance, and business risks quantitatively', description_ko: '금융, 보험 및 비즈니스 리스크의 정량적 평가', description_ja: '金融、保険、ビジネスリスクの定量的評価' },
  
  // Medical & Health
  { name_en: 'Clinical Diagnosis', name_ko: '임상 진단', name_ja: '臨床診断', category: 'analytical', ai_vulnerability: 35, ai_augmentation: 75, future_demand: 'rising', description_en: 'Interpreting symptoms, test results, and making diagnostic decisions', description_ko: '증상, 검사 결과 해석 및 진단적 의사결정', description_ja: '症状、検査結果の解釈と診断的意思決定' },
  { name_en: 'Patient Empathy', name_ko: '환자 공감 능력', name_ja: '患者共感能力', category: 'interpersonal', ai_vulnerability: 10, ai_augmentation: 25, future_demand: 'rising', description_en: 'Emotional intelligence and bedside manner in healthcare settings', description_ko: '의료 환경에서의 감정 지능 및 환자 응대 능력', description_ja: '医療環境における感情知性と患者対応能力' },
  { name_en: 'Manual Therapy', name_ko: '도수 치료 기술', name_ja: '徒手療法技術', category: 'technical', ai_vulnerability: 8, ai_augmentation: 30, future_demand: 'rising', description_en: 'Hands-on physical manipulation and therapeutic touch techniques', description_ko: '신체적 수기 조작 및 치료적 터치 기법', description_ja: '身体的な手技操作と治療的タッチ技術' },
  { name_en: 'Medical Imaging Interpretation', name_ko: '의료영상 판독', name_ja: '医療画像読影', category: 'analytical', ai_vulnerability: 65, ai_augmentation: 85, future_demand: 'stable', description_en: 'Reading and interpreting X-ray, CT, MRI, and other medical images', description_ko: 'X-ray, CT, MRI 등 의료영상 판독 및 해석', description_ja: 'X線、CT、MRI等の医療画像の読影と解釈' },
  { name_en: 'Pharmacological Knowledge', name_ko: '약리학 지식', name_ja: '薬理学知識', category: 'analytical', ai_vulnerability: 55, ai_augmentation: 75, future_demand: 'stable', description_en: 'Understanding drug interactions, dosages, and therapeutic effects', description_ko: '약물 상호작용, 용량 및 치료 효과에 대한 이해', description_ja: '薬物相互作用、用量、治療効果の理解' },
  
  // Education
  { name_en: 'Pedagogical Skills', name_ko: '교수법', name_ja: '教授法', category: 'interpersonal', ai_vulnerability: 30, ai_augmentation: 60, future_demand: 'stable', description_en: 'Teaching methodology, student engagement, and learning facilitation', description_ko: '교수 방법론, 학생 참여 유도 및 학습 촉진', description_ja: '教授方法論、学生の関与促進、学習ファシリテーション' },
  { name_en: 'Assessment Design', name_ko: '평가 설계', name_ja: '評価設計', category: 'analytical', ai_vulnerability: 65, ai_augmentation: 80, future_demand: 'stable', description_en: 'Creating effective tests, rubrics, and evaluation criteria', description_ko: '효과적인 시험, 루브릭 및 평가 기준 설계', description_ja: '効果的なテスト、ルーブリック、評価基準の設計' },
  
  // Architecture & Physical
  { name_en: 'Spatial Design', name_ko: '공간 디자인', name_ja: '空間デザイン', category: 'creative', ai_vulnerability: 45, ai_augmentation: 70, future_demand: 'stable', description_en: 'Designing functional and aesthetic spaces considering human factors', description_ko: '인간공학적 요소를 고려한 기능적이고 심미적인 공간 설계', description_ja: '人間工学的要素を考慮した機能的で美的な空間設計' },
  { name_en: 'CAD/BIM Proficiency', name_ko: 'CAD/BIM 활용', name_ja: 'CAD/BIMスキル', category: 'technical', ai_vulnerability: 65, ai_augmentation: 85, future_demand: 'rising', description_en: 'Proficiency in computer-aided design and building information modeling', description_ko: '컴퓨터 지원 설계 및 BIM 활용 능력', description_ja: 'コンピュータ支援設計とBIM活用能力' },
  
  // Service & Operations
  { name_en: 'Customer Service Excellence', name_ko: '고객 서비스 역량', name_ja: '顧客サービス能力', category: 'interpersonal', ai_vulnerability: 50, ai_augmentation: 70, future_demand: 'stable', description_en: 'Handling customer needs with empathy, patience, and problem-solving', description_ko: '공감, 인내 및 문제 해결 능력으로 고객 니즈 처리', description_ja: '共感、忍耐、問題解決能力で顧客ニーズに対応' },
  { name_en: 'Supply Chain Management', name_ko: '공급망 관리', name_ja: 'サプライチェーン管理', category: 'analytical', ai_vulnerability: 65, ai_augmentation: 80, future_demand: 'rising', description_en: 'Optimizing logistics, inventory, and distribution networks', description_ko: '물류, 재고 및 유통 네트워크 최적화', description_ja: '物流、在庫、流通ネットワークの最適化' },
  { name_en: 'Physical Security', name_ko: '물리적 보안', name_ja: '物理的セキュリティ', category: 'technical', ai_vulnerability: 40, ai_augmentation: 60, future_demand: 'stable', description_en: 'Physical patrol, threat assessment, and security system operation', description_ko: '물리적 순찰, 위협 평가 및 보안 시스템 운용', description_ja: '物理的巡回、脅威評価、セキュリティシステム運用' },
  { name_en: 'Culinary Arts', name_ko: '조리 기술', name_ja: '調理技術', category: 'technical', ai_vulnerability: 12, ai_augmentation: 35, future_demand: 'rising', description_en: 'Cooking techniques, flavor development, and food presentation', description_ko: '조리 기법, 맛 개발 및 음식 플레이팅', description_ja: '調理技法、味の開発、料理のプレゼンテーション' },
  
  // Marketing & Sales
  { name_en: 'Digital Campaign Management', name_ko: '디지털 캠페인 관리', name_ja: 'デジタルキャンペーン管理', category: 'technical', ai_vulnerability: 65, ai_augmentation: 82, future_demand: 'rising', description_en: 'Planning, executing, and analyzing online marketing campaigns', description_ko: '온라인 마케팅 캠페인 기획, 실행 및 분석', description_ja: 'オンラインマーケティングキャンペーンの企画、実行、分析' },
  { name_en: 'Negotiation', name_ko: '협상력', name_ja: '交渉力', category: 'interpersonal', ai_vulnerability: 18, ai_augmentation: 45, future_demand: 'rising', description_en: 'Ability to negotiate deals, contracts, and agreements effectively', description_ko: '거래, 계약 및 합의를 효과적으로 협상하는 능력', description_ja: '取引、契約、合意を効果的に交渉する能力' },
  { name_en: 'Public Administration', name_ko: '공공행정', name_ja: '公共行政', category: 'analytical', ai_vulnerability: 55, ai_augmentation: 70, future_demand: 'stable', description_en: 'Government procedures, policy implementation, and public service delivery', description_ko: '정부 절차, 정책 실행 및 공공 서비스 제공', description_ja: '政府手続き、政策実施、公共サービス提供' },
  { name_en: 'Property Valuation', name_ko: '부동산 감정평가', name_ja: '不動産鑑定評価', category: 'analytical', ai_vulnerability: 65, ai_augmentation: 80, future_demand: 'stable', description_en: 'Assessing property values using market data and analytical methods', description_ko: '시장 데이터와 분석적 방법을 사용한 부동산 가치 평가', description_ja: '市場データと分析的手法を用いた不動産価値評価' },
];

// Task → Skills mapping: { task_name_en: [{ skill_name_en, importance (0-100), proficiency }] }
const TASK_SKILL_MAPPINGS = {
  'Document Translation': [
    { skill: 'Bilingual Fluency', importance: 95, proficiency: 'expert' },
    { skill: 'Cultural Sensitivity', importance: 80, proficiency: 'advanced' },
    { skill: 'Persuasive Writing', importance: 60, proficiency: 'intermediate' },
  ],
  'Simultaneous Interpretation': [
    { skill: 'Bilingual Fluency', importance: 98, proficiency: 'expert' },
    { skill: 'Cultural Sensitivity', importance: 85, proficiency: 'expert' },
  ],
  'Creative Writing': [
    { skill: 'Persuasive Writing', importance: 95, proficiency: 'expert' },
    { skill: 'Cultural Sensitivity', importance: 50, proficiency: 'intermediate' },
    { skill: 'Digital Campaign Management', importance: 40, proficiency: 'basic' },
  ],
  'News Reporting': [
    { skill: 'Investigative Journalism', importance: 90, proficiency: 'advanced' },
    { skill: 'Persuasive Writing', importance: 75, proficiency: 'advanced' },
  ],
  'Content Editing': [
    { skill: 'Persuasive Writing', importance: 85, proficiency: 'advanced' },
  ],
  'Illustration/Drawing': [
    { skill: 'Visual Artistry', importance: 95, proficiency: 'expert' },
  ],
  'Video Editing': [
    { skill: 'Motion Graphics', importance: 85, proficiency: 'advanced' },
    { skill: 'Visual Artistry', importance: 70, proficiency: 'intermediate' },
  ],
  'Photo Editing/Retouching': [
    { skill: 'Visual Artistry', importance: 80, proficiency: 'advanced' },
    { skill: 'Photography Technique', importance: 70, proficiency: 'intermediate' },
  ],
  'Photo Shooting': [
    { skill: 'Photography Technique', importance: 95, proficiency: 'expert' },
    { skill: 'Visual Artistry', importance: 80, proficiency: 'advanced' },
  ],
  'Storyboarding': [
    { skill: 'Visual Artistry', importance: 80, proficiency: 'advanced' },
    { skill: 'Motion Graphics', importance: 60, proficiency: 'intermediate' },
  ],
  'Financial Auditing': [
    { skill: 'Financial Accounting', importance: 95, proficiency: 'expert' },
    { skill: 'Risk Assessment', importance: 70, proficiency: 'advanced' },
  ],
  'Tax Filing/Consulting': [
    { skill: 'Tax Law Expertise', importance: 95, proficiency: 'expert' },
    { skill: 'Financial Accounting', importance: 75, proficiency: 'advanced' },
  ],
  'Bookkeeping': [
    { skill: 'Financial Accounting', importance: 90, proficiency: 'advanced' },
  ],
  'Financial Analysis': [
    { skill: 'Financial Accounting', importance: 80, proficiency: 'advanced' },
    { skill: 'Risk Assessment', importance: 75, proficiency: 'advanced' },
  ],
  'Legal Research': [
    { skill: 'Legal Reasoning', importance: 90, proficiency: 'advanced' },
  ],
  'Contract Drafting': [
    { skill: 'Legal Reasoning', importance: 85, proficiency: 'advanced' },
    { skill: 'Persuasive Writing', importance: 65, proficiency: 'intermediate' },
  ],
  'Court Representation': [
    { skill: 'Courtroom Advocacy', importance: 95, proficiency: 'expert' },
    { skill: 'Legal Reasoning', importance: 90, proficiency: 'expert' },
    { skill: 'Negotiation', importance: 70, proficiency: 'advanced' },
  ],
  'Customer Inquiry Handling': [
    { skill: 'Customer Service Excellence', importance: 95, proficiency: 'advanced' },
  ],
  'Sales Consultation': [
    { skill: 'Negotiation', importance: 80, proficiency: 'advanced' },
    { skill: 'Customer Service Excellence', importance: 75, proficiency: 'advanced' },
  ],
  'Transaction Processing': [
    { skill: 'Financial Accounting', importance: 60, proficiency: 'intermediate' },
    { skill: 'Customer Service Excellence', importance: 50, proficiency: 'intermediate' },
  ],
  'Insurance Underwriting': [
    { skill: 'Risk Assessment', importance: 90, proficiency: 'expert' },
    { skill: 'Financial Accounting', importance: 65, proficiency: 'intermediate' },
  ],
  'Patient Diagnosis': [
    { skill: 'Clinical Diagnosis', importance: 95, proficiency: 'expert' },
    { skill: 'Patient Empathy', importance: 75, proficiency: 'advanced' },
  ],
  'Medical Imaging Analysis': [
    { skill: 'Medical Imaging Interpretation', importance: 95, proficiency: 'expert' },
    { skill: 'Clinical Diagnosis', importance: 60, proficiency: 'intermediate' },
  ],
  'Patient Care/Nursing': [
    { skill: 'Patient Empathy', importance: 90, proficiency: 'expert' },
    { skill: 'Clinical Diagnosis', importance: 50, proficiency: 'intermediate' },
  ],
  'Prescription/Dispensing': [
    { skill: 'Pharmacological Knowledge', importance: 95, proficiency: 'expert' },
    { skill: 'Clinical Diagnosis', importance: 50, proficiency: 'intermediate' },
  ],
  'Physical Rehabilitation': [
    { skill: 'Manual Therapy', importance: 95, proficiency: 'expert' },
    { skill: 'Patient Empathy', importance: 80, proficiency: 'advanced' },
  ],
  'Treatment Planning': [
    { skill: 'Clinical Diagnosis', importance: 85, proficiency: 'advanced' },
    { skill: 'Patient Empathy', importance: 60, proficiency: 'intermediate' },
  ],
  'Classroom Teaching': [
    { skill: 'Pedagogical Skills', importance: 95, proficiency: 'expert' },
    { skill: 'Patient Empathy', importance: 40, proficiency: 'intermediate' }, // re-use as general empathy
  ],
  'Grading/Assessment': [
    { skill: 'Assessment Design', importance: 90, proficiency: 'advanced' },
    { skill: 'Pedagogical Skills', importance: 60, proficiency: 'intermediate' },
  ],
  'Curriculum Development': [
    { skill: 'Pedagogical Skills', importance: 85, proficiency: 'advanced' },
    { skill: 'Assessment Design', importance: 70, proficiency: 'advanced' },
  ],
  'Student Mentoring': [
    { skill: 'Pedagogical Skills', importance: 70, proficiency: 'advanced' },
    { skill: 'Patient Empathy', importance: 80, proficiency: 'advanced' },
  ],
  'Architectural Design': [
    { skill: 'Spatial Design', importance: 95, proficiency: 'expert' },
    { skill: 'CAD/BIM Proficiency', importance: 75, proficiency: 'advanced' },
  ],
  'Blueprint/CAD Drawing': [
    { skill: 'CAD/BIM Proficiency', importance: 95, proficiency: 'expert' },
    { skill: 'Spatial Design', importance: 60, proficiency: 'intermediate' },
  ],
  'Site Inspection': [
    { skill: 'Spatial Design', importance: 60, proficiency: 'intermediate' },
  ],
  'Document Processing': [
    { skill: 'Public Administration', importance: 60, proficiency: 'intermediate' },
  ],
  'Schedule/Calendar Management': [
    { skill: 'Customer Service Excellence', importance: 50, proficiency: 'intermediate' },
  ],
  'Policy Research/Analysis': [
    { skill: 'Public Administration', importance: 85, proficiency: 'advanced' },
  ],
  'Civil Complaint Handling': [
    { skill: 'Customer Service Excellence', importance: 80, proficiency: 'advanced' },
    { skill: 'Public Administration', importance: 65, proficiency: 'intermediate' },
  ],
  'Inventory Management': [
    { skill: 'Supply Chain Management', importance: 90, proficiency: 'advanced' },
  ],
  'Route/Delivery Planning': [
    { skill: 'Supply Chain Management', importance: 85, proficiency: 'advanced' },
  ],
  'Surveillance/Patrol': [
    { skill: 'Physical Security', importance: 90, proficiency: 'advanced' },
  ],
  'Access Control': [
    { skill: 'Physical Security', importance: 80, proficiency: 'intermediate' },
  ],
  'Cooking/Food Preparation': [
    { skill: 'Culinary Arts', importance: 95, proficiency: 'expert' },
  ],
  'Menu Development': [
    { skill: 'Culinary Arts', importance: 85, proficiency: 'advanced' },
  ],
  'Kitchen Management': [
    { skill: 'Culinary Arts', importance: 60, proficiency: 'advanced' },
    { skill: 'Supply Chain Management', importance: 50, proficiency: 'intermediate' },
  ],
  'Digital Marketing': [
    { skill: 'Digital Campaign Management', importance: 90, proficiency: 'advanced' },
    { skill: 'Persuasive Writing', importance: 60, proficiency: 'intermediate' },
  ],
  'Brand Strategy': [
    { skill: 'Digital Campaign Management', importance: 60, proficiency: 'intermediate' },
    { skill: 'Negotiation', importance: 50, proficiency: 'intermediate' },
  ],
  'Property Showing/Consultation': [
    { skill: 'Property Valuation', importance: 70, proficiency: 'advanced' },
    { skill: 'Negotiation', importance: 80, proficiency: 'advanced' },
    { skill: 'Customer Service Excellence', importance: 75, proficiency: 'advanced' },
  ],
  'Market Valuation': [
    { skill: 'Property Valuation', importance: 90, proficiency: 'expert' },
    { skill: 'Financial Accounting', importance: 50, proficiency: 'intermediate' },
  ],
  'Information Retrieval': [
    { skill: 'Public Administration', importance: 50, proficiency: 'intermediate' },
    { skill: 'Pedagogical Skills', importance: 40, proficiency: 'intermediate' },
  ],
  'Collection Curation': [
    { skill: 'Public Administration', importance: 55, proficiency: 'intermediate' },
  ],
  'Client Relationship Management': [
    { skill: 'Negotiation', importance: 75, proficiency: 'advanced' },
    { skill: 'Customer Service Excellence', importance: 70, proficiency: 'advanced' },
  ],
  'Report Writing': [
    { skill: 'Persuasive Writing', importance: 70, proficiency: 'intermediate' },
  ],
  'Compliance/Regulation Review': [
    { skill: 'Legal Reasoning', importance: 60, proficiency: 'intermediate' },
    { skill: 'Risk Assessment', importance: 55, proficiency: 'intermediate' },
  ],
  'Emergency Response': [
    { skill: 'Physical Security', importance: 80, proficiency: 'advanced' },
  ],
};

async function main() {
  console.log('🚀 Phase 2 Step 2: Adding non-IT skills + task_skills\n');

  // Step 1: Insert skills
  console.log('🎯 Inserting skills...');
  const skillIdMap = {};
  
  // Load existing skills
  const { data: existingSkills } = await supabase.from('skills').select('id, name_en');
  for (const s of existingSkills) skillIdMap[s.name_en] = s.id;

  for (const skill of NON_IT_SKILLS) {
    if (skillIdMap[skill.name_en]) {
      console.log(`  ✓ ${skill.name_en} (existing)`);
      continue;
    }
    const { data, error } = await supabase.from('skills').insert(skill).select('id').single();
    if (error) { console.error(`  ✗ ${skill.name_en}: ${error.message}`); continue; }
    skillIdMap[skill.name_en] = data.id;
    console.log(`  + ${skill.name_en}`);
  }
  console.log(`  Total skills: ${Object.keys(skillIdMap).length}\n`);

  // Step 2: Load task IDs
  const { data: allTasks } = await supabase.from('tasks').select('id, name_en');
  const taskIdMap = {};
  for (const t of allTasks) taskIdMap[t.name_en] = t.id;

  // Step 3: Insert task_skills
  console.log('🔗 Mapping tasks → skills...');
  let count = 0;
  for (const [taskName, skills] of Object.entries(TASK_SKILL_MAPPINGS)) {
    const taskId = taskIdMap[taskName];
    if (!taskId) { console.error(`  ✗ Task not found: ${taskName}`); continue; }

    for (const { skill, importance, proficiency } of skills) {
      const skillId = skillIdMap[skill];
      if (!skillId) { console.error(`  ✗ Skill not found: ${skill}`); continue; }

      const { error } = await supabase.from('task_skills').upsert({
        task_id: taskId,
        skill_id: skillId,
        importance,
        proficiency_required: proficiency,
      }, { onConflict: 'task_id,skill_id' });

      if (error) console.error(`  ✗ ${taskName}→${skill}: ${error.message}`);
      else count++;
    }
  }
  console.log(`  ✓ ${count} task_skills mappings added\n`);

  console.log('✅ Phase 2 Step 2 complete!');
}

main().catch(console.error);
