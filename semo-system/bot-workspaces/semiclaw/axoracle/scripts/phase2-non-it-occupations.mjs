/**
 * Phase 2: Add 30 non-IT occupations
 * Step 1: Insert occupations + tasks + occupation_tasks + occupation_countries + occupation_task_experience
 * 
 * Run: node scripts/phase2-non-it-occupations.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 30 non-IT occupations sorted by AI anxiety level
const NON_IT_OCCUPATIONS = [
  // === HIGH AI anxiety ===
  { name_en: 'Translator/Interpreter', name_ko: '번역가/통역사', name_ja: '翻訳者/通訳者', ai_impact_score: 82.5 },
  { name_en: 'Copywriter', name_ko: '카피라이터', name_ja: 'コピーライター', ai_impact_score: 79.0 },
  { name_en: 'Journalist', name_ko: '기자', name_ja: 'ジャーナリスト', ai_impact_score: 72.0 },
  { name_en: 'Illustrator', name_ko: '일러스트레이터', name_ja: 'イラストレーター', ai_impact_score: 78.5 },
  { name_en: 'Video Editor', name_ko: '영상편집자', name_ja: '映像編集者', ai_impact_score: 71.0 },
  { name_en: 'Call Center Agent', name_ko: '콜센터 상담원', name_ja: 'コールセンターオペレーター', ai_impact_score: 85.0 },
  { name_en: 'Bank Teller', name_ko: '은행원', name_ja: '銀行窓口担当者', ai_impact_score: 83.0 },
  { name_en: 'Accountant', name_ko: '회계사', name_ja: '会計士', ai_impact_score: 75.0 },
  { name_en: 'Tax Accountant', name_ko: '세무사', name_ja: '税理士', ai_impact_score: 72.5 },
  { name_en: 'Insurance Agent', name_ko: '보험설계사', name_ja: '保険外交員', ai_impact_score: 74.0 },
  { name_en: 'Paralegal', name_ko: '법률사무원', name_ja: 'パラリーガル', ai_impact_score: 76.0 },
  { name_en: 'Office Administrator', name_ko: '사무행정원', name_ja: '事務管理者', ai_impact_score: 78.0 },
  { name_en: 'Librarian', name_ko: '사서', name_ja: '司書', ai_impact_score: 68.0 },
  { name_en: 'Radiologic Technologist', name_ko: '방사선사', name_ja: '診療放射線技師', ai_impact_score: 65.0 },
  
  // === MEDIUM AI anxiety ===
  { name_en: 'Lawyer', name_ko: '변호사', name_ja: '弁護士', ai_impact_score: 58.0 },
  { name_en: 'Financial Analyst', name_ko: '금융분석가', name_ja: '金融アナリスト', ai_impact_score: 68.5 },
  { name_en: 'Marketer', name_ko: '마케터', name_ja: 'マーケター', ai_impact_score: 66.0 },
  { name_en: 'Real Estate Agent', name_ko: '부동산중개사', name_ja: '不動産仲介士', ai_impact_score: 62.0 },
  { name_en: 'Pharmacist', name_ko: '약사', name_ja: '薬剤師', ai_impact_score: 55.0 },
  { name_en: 'Teacher', name_ko: '교사', name_ja: '教師', ai_impact_score: 48.0 },
  { name_en: 'Architect', name_ko: '건축사', name_ja: '建築士', ai_impact_score: 52.0 },
  
  // === LOWER anxiety but high curiosity ===
  { name_en: 'Doctor', name_ko: '의사', name_ja: '医師', ai_impact_score: 42.0 },
  { name_en: 'Nurse', name_ko: '간호사', name_ja: '看護師', ai_impact_score: 35.0 },
  { name_en: 'Chef', name_ko: '요리사', name_ja: 'シェフ', ai_impact_score: 28.0 },
  { name_en: 'Physical Therapist', name_ko: '물리치료사', name_ja: '理学療法士', ai_impact_score: 32.0 },
  { name_en: 'Government Administrator', name_ko: '행정공무원', name_ja: '行政公務員', ai_impact_score: 60.0 },
  { name_en: 'Logistics Manager', name_ko: '물류관리사', name_ja: '物流管理者', ai_impact_score: 58.5 },
  { name_en: 'Security Guard', name_ko: '경비원', name_ja: '警備員', ai_impact_score: 55.0 },
  { name_en: 'Photographer', name_ko: '사진작가', name_ja: 'フォトグラファー', ai_impact_score: 60.5 },
  { name_en: 'Academy Instructor', name_ko: '학원강사', name_ja: '塾講師', ai_impact_score: 52.0 },
];

// Non-IT specific tasks with categories
const NON_IT_TASKS = [
  // Translation & Writing
  { name_en: 'Document Translation', name_kr: '문서 번역', category: 'Translation', description: 'Translating documents between languages while preserving meaning and nuance', description_ko: '의미와 뉘앙스를 유지하며 언어 간 문서 번역', description_en: 'Translating documents between languages while preserving meaning and nuance', description_ja: '意味とニュアンスを維持しながら言語間で文書を翻訳', time_percentage: 30, ai_replacement_rate: 85, ai_replacement_rate_1y: 88, ai_replacement_rate_3y: 92 },
  { name_en: 'Simultaneous Interpretation', name_kr: '동시통역', category: 'Translation', description: 'Real-time oral translation during meetings and conferences', description_ko: '회의 및 컨퍼런스에서의 실시간 구두 번역', description_en: 'Real-time oral translation during meetings and conferences', description_ja: '会議やカンファレンスでのリアルタイム口頭翻訳', time_percentage: 25, ai_replacement_rate: 65, ai_replacement_rate_1y: 72, ai_replacement_rate_3y: 82 },
  { name_en: 'Creative Writing', name_kr: '크리에이티브 라이팅', category: 'Writing', description: 'Writing persuasive, engaging copy for ads, brands, and campaigns', description_ko: '광고, 브랜드, 캠페인용 설득력 있는 카피 작성', description_en: 'Writing persuasive, engaging copy for ads, brands, and campaigns', description_ja: '広告、ブランド、キャンペーン用の説得力のあるコピー作成', time_percentage: 30, ai_replacement_rate: 75, ai_replacement_rate_1y: 80, ai_replacement_rate_3y: 88 },
  { name_en: 'News Reporting', name_kr: '취재/보도', category: 'Writing', description: 'Gathering information, interviewing sources, and writing news articles', description_ko: '정보 수집, 취재원 인터뷰, 뉴스 기사 작성', description_en: 'Gathering information, interviewing sources, and writing news articles', description_ja: '情報収集、取材源インタビュー、ニュース記事の作成', time_percentage: 30, ai_replacement_rate: 55, ai_replacement_rate_1y: 62, ai_replacement_rate_3y: 72 },
  { name_en: 'Content Editing', name_kr: '콘텐츠 편집', category: 'Writing', description: 'Reviewing and refining written content for clarity, accuracy, and style', description_ko: '명확성, 정확성, 스타일을 위한 콘텐츠 검토 및 수정', description_en: 'Reviewing and refining written content for clarity, accuracy, and style', description_ja: '明確さ、正確さ、スタイルのためのコンテンツレビューと修正', time_percentage: 15, ai_replacement_rate: 70, ai_replacement_rate_1y: 75, ai_replacement_rate_3y: 82 },
  
  // Creative & Design (non-IT)
  { name_en: 'Illustration/Drawing', name_kr: '일러스트 제작', category: 'Creative', description: 'Creating original illustrations, concept art, and visual artwork', description_ko: '오리지널 일러스트, 컨셉 아트, 비주얼 아트워크 제작', description_en: 'Creating original illustrations, concept art, and visual artwork', description_ja: 'オリジナルイラスト、コンセプトアート、ビジュアルアートワーク制作', time_percentage: 35, ai_replacement_rate: 75, ai_replacement_rate_1y: 80, ai_replacement_rate_3y: 88 },
  { name_en: 'Video Editing', name_kr: '영상 편집', category: 'Creative', description: 'Cutting, arranging, and enhancing video footage with effects and transitions', description_ko: '영상 컷 편집, 이펙트 및 트랜지션 적용', description_en: 'Cutting, arranging, and enhancing video footage with effects and transitions', description_ja: '映像カット編集、エフェクトとトランジションの適用', time_percentage: 35, ai_replacement_rate: 68, ai_replacement_rate_1y: 75, ai_replacement_rate_3y: 85 },
  { name_en: 'Photo Editing/Retouching', name_kr: '사진 편집/보정', category: 'Creative', description: 'Post-processing photos for color correction, retouching, and compositing', description_ko: '색보정, 리터칭, 합성 등 사진 후보정', description_en: 'Post-processing photos for color correction, retouching, and compositing', description_ja: '色補正、レタッチ、合成等の写真後処理', time_percentage: 20, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 86 },
  { name_en: 'Photo Shooting', name_kr: '사진 촬영', category: 'Creative', description: 'Planning and executing photo shoots with proper lighting and composition', description_ko: '적절한 조명과 구도로 사진 촬영 기획 및 실행', description_en: 'Planning and executing photo shoots with proper lighting and composition', description_ja: '適切なライティングと構図で写真撮影の企画と実行', time_percentage: 30, ai_replacement_rate: 25, ai_replacement_rate_1y: 30, ai_replacement_rate_3y: 40 },
  { name_en: 'Storyboarding', name_kr: '스토리보드 제작', category: 'Creative', description: 'Creating visual sequences to plan video or animation flow', description_ko: '영상 또는 애니메이션 흐름을 계획하기 위한 비주얼 시퀀스 제작', description_en: 'Creating visual sequences to plan video or animation flow', description_ja: '映像またはアニメーションの流れを計画するビジュアルシーケンス作成', time_percentage: 10, ai_replacement_rate: 70, ai_replacement_rate_1y: 75, ai_replacement_rate_3y: 82 },
  
  // Finance & Legal
  { name_en: 'Financial Auditing', name_kr: '재무 감사', category: 'Finance', description: 'Examining financial records to ensure accuracy and regulatory compliance', description_ko: '재무 기록의 정확성 및 규정 준수 여부 점검', description_en: 'Examining financial records to ensure accuracy and regulatory compliance', description_ja: '財務記録の正確性と規制遵守の確認', time_percentage: 25, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 85 },
  { name_en: 'Tax Filing/Consulting', name_kr: '세무 신고/상담', category: 'Finance', description: 'Preparing tax returns and providing tax optimization advice', description_ko: '세무 신고서 작성 및 세무 최적화 자문', description_en: 'Preparing tax returns and providing tax optimization advice', description_ja: '確定申告書の作成と税務最適化のアドバイス', time_percentage: 30, ai_replacement_rate: 70, ai_replacement_rate_1y: 75, ai_replacement_rate_3y: 82 },
  { name_en: 'Bookkeeping', name_kr: '장부 기장', category: 'Finance', description: 'Recording daily financial transactions and maintaining ledgers', description_ko: '일일 재무 거래 기록 및 장부 유지', description_en: 'Recording daily financial transactions and maintaining ledgers', description_ja: '日常の財務取引の記録と帳簿の管理', time_percentage: 20, ai_replacement_rate: 88, ai_replacement_rate_1y: 90, ai_replacement_rate_3y: 95 },
  { name_en: 'Financial Analysis', name_kr: '재무 분석', category: 'Finance', description: 'Analyzing financial data, creating models, and forecasting trends', description_ko: '재무 데이터 분석, 모델 생성 및 트렌드 예측', description_en: 'Analyzing financial data, creating models, and forecasting trends', description_ja: '財務データ分析、モデル作成、トレンド予測', time_percentage: 25, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 85 },
  { name_en: 'Legal Research', name_kr: '판례/법률 조사', category: 'Legal', description: 'Researching case law, statutes, and legal precedents', description_ko: '판례, 법령 및 법적 선례 조사', description_en: 'Researching case law, statutes, and legal precedents', description_ja: '判例、法令、法的先例の調査', time_percentage: 25, ai_replacement_rate: 78, ai_replacement_rate_1y: 82, ai_replacement_rate_3y: 88 },
  { name_en: 'Contract Drafting', name_kr: '계약서 작성', category: 'Legal', description: 'Drafting, reviewing, and negotiating legal contracts and agreements', description_ko: '법률 계약서 및 합의서 작성, 검토 및 협상', description_en: 'Drafting, reviewing, and negotiating legal contracts and agreements', description_ja: '法律契約書と合意書の作成、レビュー、交渉', time_percentage: 20, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 85 },
  { name_en: 'Court Representation', name_kr: '법정 변론', category: 'Legal', description: 'Representing clients in court proceedings and oral arguments', description_ko: '법정 절차 및 구두 변론에서 의뢰인 대리', description_en: 'Representing clients in court proceedings and oral arguments', description_ja: '法廷手続きと口頭弁論でのクライアント代理', time_percentage: 15, ai_replacement_rate: 20, ai_replacement_rate_1y: 25, ai_replacement_rate_3y: 35 },
  
  // Customer Service & Sales
  { name_en: 'Customer Inquiry Handling', name_kr: '고객 문의 응대', category: 'Service', description: 'Answering customer questions and resolving issues via phone, chat, or email', description_ko: '전화, 채팅, 이메일을 통한 고객 문의 답변 및 문제 해결', description_en: 'Answering customer questions and resolving issues via phone, chat, or email', description_ja: '電話、チャット、メールを通じた顧客問い合わせ対応と問題解決', time_percentage: 40, ai_replacement_rate: 82, ai_replacement_rate_1y: 88, ai_replacement_rate_3y: 92 },
  { name_en: 'Sales Consultation', name_kr: '영업/상담', category: 'Service', description: 'Consulting with clients to understand needs and recommend products/services', description_ko: '고객 니즈 파악 및 제품/서비스 추천 상담', description_en: 'Consulting with clients to understand needs and recommend products/services', description_ja: '顧客ニーズの把握と製品/サービスの推薦相談', time_percentage: 25, ai_replacement_rate: 55, ai_replacement_rate_1y: 62, ai_replacement_rate_3y: 72 },
  { name_en: 'Transaction Processing', name_kr: '거래 처리', category: 'Service', description: 'Processing financial transactions, deposits, withdrawals, and transfers', description_ko: '금융 거래, 입금, 출금, 이체 처리', description_en: 'Processing financial transactions, deposits, withdrawals, and transfers', description_ja: '金融取引、入金、出金、振替の処理', time_percentage: 30, ai_replacement_rate: 90, ai_replacement_rate_1y: 92, ai_replacement_rate_3y: 95 },
  { name_en: 'Insurance Underwriting', name_kr: '보험 심사/설계', category: 'Finance', description: 'Evaluating risk and designing insurance plans for clients', description_ko: '리스크 평가 및 고객 맞춤 보험 설계', description_en: 'Evaluating risk and designing insurance plans for clients', description_ja: 'リスク評価と顧客向け保険プラン設計', time_percentage: 25, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 85 },
  
  // Medical & Health
  { name_en: 'Patient Diagnosis', name_kr: '환자 진단', category: 'Medical', description: 'Examining patients, interpreting symptoms, and making diagnostic decisions', description_ko: '환자 진찰, 증상 해석 및 진단적 의사결정', description_en: 'Examining patients, interpreting symptoms, and making diagnostic decisions', description_ja: '患者の診察、症状の解釈、診断的意思決定', time_percentage: 30, ai_replacement_rate: 35, ai_replacement_rate_1y: 40, ai_replacement_rate_3y: 50 },
  { name_en: 'Medical Imaging Analysis', name_kr: '의료영상 분석', category: 'Medical', description: 'Analyzing X-rays, CT scans, MRI images for diagnostic purposes', description_ko: 'X-ray, CT, MRI 등 의료영상 분석 및 판독', description_en: 'Analyzing X-rays, CT scans, MRI images for diagnostic purposes', description_ja: 'X線、CT、MRI等の医療画像分析と読影', time_percentage: 35, ai_replacement_rate: 65, ai_replacement_rate_1y: 72, ai_replacement_rate_3y: 82 },
  { name_en: 'Patient Care/Nursing', name_kr: '환자 간호/케어', category: 'Medical', description: 'Providing direct physical care, monitoring vitals, and administering treatments', description_ko: '직접적인 신체 간호, 활력징후 모니터링, 치료 시행', description_en: 'Providing direct physical care, monitoring vitals, and administering treatments', description_ja: '直接的な身体ケア、バイタルサインモニタリング、治療の実施', time_percentage: 40, ai_replacement_rate: 18, ai_replacement_rate_1y: 22, ai_replacement_rate_3y: 30 },
  { name_en: 'Prescription/Dispensing', name_kr: '처방/조제', category: 'Medical', description: 'Reviewing prescriptions, dispensing medications, and checking interactions', description_ko: '처방전 검토, 의약품 조제 및 상호작용 확인', description_en: 'Reviewing prescriptions, dispensing medications, and checking interactions', description_ja: '処方箋の確認、医薬品の調剤、相互作用のチェック', time_percentage: 30, ai_replacement_rate: 65, ai_replacement_rate_1y: 70, ai_replacement_rate_3y: 78 },
  { name_en: 'Physical Rehabilitation', name_kr: '물리재활 치료', category: 'Medical', description: 'Hands-on therapeutic exercises and manual therapy for patient recovery', description_ko: '환자 회복을 위한 운동 치료 및 도수 치료', description_en: 'Hands-on therapeutic exercises and manual therapy for patient recovery', description_ja: '患者回復のための運動療法と徒手療法', time_percentage: 40, ai_replacement_rate: 15, ai_replacement_rate_1y: 18, ai_replacement_rate_3y: 25 },
  { name_en: 'Treatment Planning', name_kr: '치료 계획 수립', category: 'Medical', description: 'Developing individualized treatment and recovery plans', description_ko: '개인별 맞춤 치료 및 회복 계획 수립', description_en: 'Developing individualized treatment and recovery plans', description_ja: '個別化された治療・回復計画の策定', time_percentage: 15, ai_replacement_rate: 45, ai_replacement_rate_1y: 52, ai_replacement_rate_3y: 62 },
  
  // Education
  { name_en: 'Classroom Teaching', name_kr: '수업/강의', category: 'Education', description: 'Delivering lessons, explaining concepts, and facilitating learning activities', description_ko: '수업 진행, 개념 설명 및 학습 활동 진행', description_en: 'Delivering lessons, explaining concepts, and facilitating learning activities', description_ja: '授業の実施、概念の説明、学習活動の進行', time_percentage: 35, ai_replacement_rate: 35, ai_replacement_rate_1y: 40, ai_replacement_rate_3y: 50 },
  { name_en: 'Grading/Assessment', name_kr: '채점/평가', category: 'Education', description: 'Evaluating student work, creating tests, and providing feedback', description_ko: '학생 과제 평가, 시험 출제 및 피드백 제공', description_en: 'Evaluating student work, creating tests, and providing feedback', description_ja: '学生の課題評価、テスト作成、フィードバック提供', time_percentage: 20, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 85 },
  { name_en: 'Curriculum Development', name_kr: '커리큘럼 개발', category: 'Education', description: 'Designing course structures, learning materials, and educational content', description_ko: '교과과정 구조, 학습 자료 및 교육 콘텐츠 설계', description_en: 'Designing course structures, learning materials, and educational content', description_ja: 'カリキュラム構造、学習教材、教育コンテンツの設計', time_percentage: 15, ai_replacement_rate: 62, ai_replacement_rate_1y: 68, ai_replacement_rate_3y: 75 },
  { name_en: 'Student Mentoring', name_kr: '학생 멘토링/상담', category: 'Education', description: 'Providing emotional support, career guidance, and personal development advice', description_ko: '정서적 지원, 진로 지도 및 개인 발달 조언 제공', description_en: 'Providing emotional support, career guidance, and personal development advice', description_ja: '精神的サポート、進路指導、個人的成長のアドバイス提供', time_percentage: 10, ai_replacement_rate: 25, ai_replacement_rate_1y: 30, ai_replacement_rate_3y: 38 },
  
  // Architecture & Construction
  { name_en: 'Architectural Design', name_kr: '건축 설계', category: 'Architecture', description: 'Designing buildings and structures considering aesthetics, function, and regulations', description_ko: '미학, 기능성 및 규정을 고려한 건축물 설계', description_en: 'Designing buildings and structures considering aesthetics, function, and regulations', description_ja: '美学、機能性、規制を考慮した建築物の設計', time_percentage: 30, ai_replacement_rate: 48, ai_replacement_rate_1y: 55, ai_replacement_rate_3y: 65 },
  { name_en: 'Blueprint/CAD Drawing', name_kr: '도면/CAD 작업', category: 'Architecture', description: 'Creating detailed technical drawings and 3D models using CAD software', description_ko: 'CAD 소프트웨어를 사용한 상세 기술 도면 및 3D 모델 제작', description_en: 'Creating detailed technical drawings and 3D models using CAD software', description_ja: 'CADソフトウェアを使用した詳細な技術図面と3Dモデルの作成', time_percentage: 25, ai_replacement_rate: 68, ai_replacement_rate_1y: 75, ai_replacement_rate_3y: 85 },
  { name_en: 'Site Inspection', name_kr: '현장 점검', category: 'Architecture', description: 'Visiting construction sites to verify compliance with plans and safety codes', description_ko: '설계도면 및 안전 규정 준수 여부 현장 확인', description_en: 'Visiting construction sites to verify compliance with plans and safety codes', description_ja: '設計図面と安全規定の遵守を確認する現場検査', time_percentage: 15, ai_replacement_rate: 20, ai_replacement_rate_1y: 25, ai_replacement_rate_3y: 35 },
  
  // Admin & Government
  { name_en: 'Document Processing', name_kr: '문서 처리/관리', category: 'Admin', description: 'Processing, filing, organizing, and managing official documents', description_ko: '공문서 처리, 정리, 분류 및 관리', description_en: 'Processing, filing, organizing, and managing official documents', description_ja: '公文書の処理、整理、分類、管理', time_percentage: 25, ai_replacement_rate: 82, ai_replacement_rate_1y: 85, ai_replacement_rate_3y: 92 },
  { name_en: 'Schedule/Calendar Management', name_kr: '일정/스케줄 관리', category: 'Admin', description: 'Managing appointments, meetings, travel arrangements, and calendars', description_ko: '약속, 회의, 출장 일정 및 캘린더 관리', description_en: 'Managing appointments, meetings, travel arrangements, and calendars', description_ja: '予約、会議、出張日程、カレンダーの管理', time_percentage: 15, ai_replacement_rate: 85, ai_replacement_rate_1y: 88, ai_replacement_rate_3y: 92 },
  { name_en: 'Policy Research/Analysis', name_kr: '정책 조사/분석', category: 'Admin', description: 'Researching policy issues, analyzing data, and drafting policy recommendations', description_ko: '정책 이슈 조사, 데이터 분석 및 정책 제안 작성', description_en: 'Researching policy issues, analyzing data, and drafting policy recommendations', description_ja: '政策課題の調査、データ分析、政策提言の作成', time_percentage: 20, ai_replacement_rate: 68, ai_replacement_rate_1y: 72, ai_replacement_rate_3y: 80 },
  { name_en: 'Civil Complaint Handling', name_kr: '민원 처리', category: 'Admin', description: 'Receiving and processing citizen complaints and service requests', description_ko: '시민 민원 및 서비스 요청 접수 및 처리', description_en: 'Receiving and processing citizen complaints and service requests', description_ja: '市民の苦情とサービスリクエストの受付と処理', time_percentage: 20, ai_replacement_rate: 65, ai_replacement_rate_1y: 72, ai_replacement_rate_3y: 80 },
  
  // Logistics & Security
  { name_en: 'Inventory Management', name_kr: '재고 관리', category: 'Logistics', description: 'Tracking stock levels, managing warehouses, and optimizing supply chains', description_ko: '재고 수준 추적, 창고 관리 및 공급망 최적화', description_en: 'Tracking stock levels, managing warehouses, and optimizing supply chains', description_ja: '在庫レベルの追跡、倉庫管理、サプライチェーンの最適化', time_percentage: 25, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 85 },
  { name_en: 'Route/Delivery Planning', name_kr: '배송/경로 계획', category: 'Logistics', description: 'Planning optimal delivery routes and transportation schedules', description_ko: '최적 배송 경로 및 운송 일정 계획', description_en: 'Planning optimal delivery routes and transportation schedules', description_ja: '最適な配送ルートと輸送スケジュールの計画', time_percentage: 20, ai_replacement_rate: 82, ai_replacement_rate_1y: 85, ai_replacement_rate_3y: 90 },
  { name_en: 'Surveillance/Patrol', name_kr: '감시/순찰', category: 'Security', description: 'Monitoring security cameras and conducting physical patrol rounds', description_ko: '보안 카메라 모니터링 및 물리적 순찰', description_en: 'Monitoring security cameras and conducting physical patrol rounds', description_ja: '防犯カメラの監視と物理的な巡回パトロール', time_percentage: 40, ai_replacement_rate: 55, ai_replacement_rate_1y: 62, ai_replacement_rate_3y: 72 },
  { name_en: 'Access Control', name_kr: '출입 통제', category: 'Security', description: 'Managing building access, verifying identities, and controlling entry points', description_ko: '건물 출입 관리, 신원 확인 및 출입구 통제', description_en: 'Managing building access, verifying identities, and controlling entry points', description_ja: '建物の出入り管理、身元確認、入口の制御', time_percentage: 25, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 85 },
  
  // Food & Hospitality
  { name_en: 'Cooking/Food Preparation', name_kr: '조리/식재료 준비', category: 'Hospitality', description: 'Preparing and cooking dishes with proper techniques and presentation', description_ko: '적절한 기술과 플레이팅으로 요리 준비 및 조리', description_en: 'Preparing and cooking dishes with proper techniques and presentation', description_ja: '適切な技術と盛り付けで料理の準備と調理', time_percentage: 45, ai_replacement_rate: 18, ai_replacement_rate_1y: 22, ai_replacement_rate_3y: 30 },
  { name_en: 'Menu Development', name_kr: '메뉴 개발', category: 'Hospitality', description: 'Creating new dishes, designing menus, and experimenting with ingredients', description_ko: '신메뉴 개발, 메뉴 구성 및 식재료 실험', description_en: 'Creating new dishes, designing menus, and experimenting with ingredients', description_ja: '新メニュー開発、メニュー構成、食材の実験', time_percentage: 15, ai_replacement_rate: 42, ai_replacement_rate_1y: 48, ai_replacement_rate_3y: 58 },
  { name_en: 'Kitchen Management', name_kr: '주방 관리', category: 'Hospitality', description: 'Managing kitchen staff, inventory, food safety, and operations', description_ko: '주방 직원, 재고, 식품 안전 및 운영 관리', description_en: 'Managing kitchen staff, inventory, food safety, and operations', description_ja: '厨房スタッフ、在庫、食品安全、運営の管理', time_percentage: 20, ai_replacement_rate: 35, ai_replacement_rate_1y: 40, ai_replacement_rate_3y: 50 },
  
  // Marketing & Real Estate
  { name_en: 'Digital Marketing', name_kr: '디지털 마케팅', category: 'Marketing', description: 'Managing online campaigns, social media, SEO, and digital advertising', description_ko: '온라인 캠페인, 소셜미디어, SEO 및 디지털 광고 관리', description_en: 'Managing online campaigns, social media, SEO, and digital advertising', description_ja: 'オンラインキャンペーン、SNS、SEO、デジタル広告の管理', time_percentage: 25, ai_replacement_rate: 68, ai_replacement_rate_1y: 75, ai_replacement_rate_3y: 82 },
  { name_en: 'Brand Strategy', name_kr: '브랜드 전략', category: 'Marketing', description: 'Developing brand positioning, messaging frameworks, and market differentiation', description_ko: '브랜드 포지셔닝, 메시지 프레임워크 및 시장 차별화 전략 개발', description_en: 'Developing brand positioning, messaging frameworks, and market differentiation', description_ja: 'ブランドポジショニング、メッセージフレームワーク、市場差別化戦略の開発', time_percentage: 15, ai_replacement_rate: 45, ai_replacement_rate_1y: 52, ai_replacement_rate_3y: 62 },
  { name_en: 'Property Showing/Consultation', name_kr: '매물 안내/상담', category: 'Service', description: 'Showing properties to clients and providing real estate consultation', description_ko: '고객에게 매물 안내 및 부동산 상담 제공', description_en: 'Showing properties to clients and providing real estate consultation', description_ja: '顧客への物件案内と不動産相談の提供', time_percentage: 30, ai_replacement_rate: 30, ai_replacement_rate_1y: 35, ai_replacement_rate_3y: 45 },
  { name_en: 'Market Valuation', name_kr: '시세/감정 평가', category: 'Finance', description: 'Analyzing property values, market trends, and comparative assessments', description_ko: '부동산 가치, 시장 동향 및 비교 평가 분석', description_en: 'Analyzing property values, market trends, and comparative assessments', description_ja: '不動産価値、市場動向、比較評価の分析', time_percentage: 20, ai_replacement_rate: 72, ai_replacement_rate_1y: 78, ai_replacement_rate_3y: 85 },
  
  // Library
  { name_en: 'Information Retrieval', name_kr: '정보 검색/레퍼런스', category: 'Admin', description: 'Helping users find information, research materials, and reference resources', description_ko: '이용자의 정보, 연구 자료 및 참고 자료 검색 지원', description_en: 'Helping users find information, research materials, and reference resources', description_ja: '利用者の情報、研究資料、参考資料の検索支援', time_percentage: 25, ai_replacement_rate: 75, ai_replacement_rate_1y: 80, ai_replacement_rate_3y: 88 },
  { name_en: 'Collection Curation', name_kr: '장서 관리/큐레이션', category: 'Admin', description: 'Selecting, organizing, and curating library collections and catalogs', description_ko: '도서관 장서 및 목록 선정, 정리 및 큐레이션', description_en: 'Selecting, organizing, and curating library collections and catalogs', description_ja: '図書館蔵書とカタログの選定、整理、キュレーション', time_percentage: 20, ai_replacement_rate: 62, ai_replacement_rate_1y: 68, ai_replacement_rate_3y: 78 },
  
  // Client relations (reusable)
  { name_en: 'Client Relationship Management', name_kr: '고객 관계 관리', category: 'Service', description: 'Building and maintaining long-term client relationships and trust', description_ko: '장기적인 고객 관계 및 신뢰 구축 및 유지', description_en: 'Building and maintaining long-term client relationships and trust', description_ja: '長期的な顧客関係と信頼の構築と維持', time_percentage: 15, ai_replacement_rate: 30, ai_replacement_rate_1y: 35, ai_replacement_rate_3y: 42 },
  { name_en: 'Report Writing', name_kr: '보고서 작성', category: 'Writing', description: 'Writing analytical reports, summaries, and formal documentation', description_ko: '분석 보고서, 요약 및 공식 문서 작성', description_en: 'Writing analytical reports, summaries, and formal documentation', description_ja: '分析レポート、要約、公式文書の作成', time_percentage: 15, ai_replacement_rate: 75, ai_replacement_rate_1y: 80, ai_replacement_rate_3y: 88 },
  { name_en: 'Compliance/Regulation Review', name_kr: '규정/컴플라이언스 검토', category: 'Legal', description: 'Reviewing operations for regulatory compliance and identifying risks', description_ko: '규정 준수 여부 검토 및 리스크 식별', description_en: 'Reviewing operations for regulatory compliance and identifying risks', description_ja: '規制遵守の確認とリスクの特定', time_percentage: 10, ai_replacement_rate: 68, ai_replacement_rate_1y: 72, ai_replacement_rate_3y: 80 },
  { name_en: 'Emergency Response', name_kr: '비상 대응', category: 'Security', description: 'Responding to emergencies, incidents, and security threats', description_ko: '비상 상황, 사건 및 보안 위협에 대한 대응', description_en: 'Responding to emergencies, incidents, and security threats', description_ja: '緊急事態、事件、セキュリティ脅威への対応', time_percentage: 15, ai_replacement_rate: 25, ai_replacement_rate_1y: 30, ai_replacement_rate_3y: 38 },
];

// Occupation → Task mappings with per-occupation overrides [time_%, ai_replace_%]
const OCCUPATION_TASK_MAPPINGS = {
  'Translator/Interpreter': {
    'Document Translation': [40, 85], 'Simultaneous Interpretation': [30, 65], 'Content Editing': [15, 70],
    'Client Relationship Management': [10, 30], 'Report Writing': [5, 75],
  },
  'Copywriter': {
    'Creative Writing': [40, 78], 'Content Editing': [15, 72], 'Digital Marketing': [15, 68],
    'Brand Strategy': [15, 45], 'Client Relationship Management': [10, 30], 'Report Writing': [5, 75],
  },
  'Journalist': {
    'News Reporting': [35, 55], 'Creative Writing': [20, 72], 'Content Editing': [15, 70],
    'Report Writing': [15, 75], 'Client Relationship Management': [10, 25], 'Digital Marketing': [5, 65],
  },
  'Illustrator': {
    'Illustration/Drawing': [45, 78], 'Storyboarding': [15, 70], 'Client Relationship Management': [15, 28],
    'Photo Editing/Retouching': [10, 72], 'Brand Strategy': [10, 45], 'Digital Marketing': [5, 65],
  },
  'Video Editor': {
    'Video Editing': [45, 70], 'Storyboarding': [15, 70], 'Photo Editing/Retouching': [15, 72],
    'Creative Writing': [10, 72], 'Client Relationship Management': [10, 28], 'Digital Marketing': [5, 65],
  },
  'Call Center Agent': {
    'Customer Inquiry Handling': [55, 85], 'Sales Consultation': [20, 55], 'Report Writing': [10, 78],
    'Document Processing': [10, 82], 'Client Relationship Management': [5, 30],
  },
  'Bank Teller': {
    'Transaction Processing': [40, 92], 'Customer Inquiry Handling': [20, 82], 'Sales Consultation': [15, 55],
    'Document Processing': [15, 85], 'Compliance/Regulation Review': [10, 68],
  },
  'Accountant': {
    'Financial Auditing': [25, 72], 'Bookkeeping': [20, 88], 'Tax Filing/Consulting': [20, 70],
    'Financial Analysis': [15, 72], 'Report Writing': [10, 75], 'Compliance/Regulation Review': [10, 68],
  },
  'Tax Accountant': {
    'Tax Filing/Consulting': [35, 72], 'Financial Auditing': [15, 70], 'Bookkeeping': [15, 85],
    'Client Relationship Management': [15, 30], 'Compliance/Regulation Review': [10, 68], 'Report Writing': [10, 75],
  },
  'Insurance Agent': {
    'Insurance Underwriting': [25, 72], 'Sales Consultation': [25, 55], 'Client Relationship Management': [20, 30],
    'Document Processing': [15, 82], 'Market Valuation': [10, 72], 'Report Writing': [5, 75],
  },
  'Paralegal': {
    'Legal Research': [30, 78], 'Contract Drafting': [25, 72], 'Document Processing': [20, 82],
    'Report Writing': [10, 75], 'Compliance/Regulation Review': [10, 68], 'Client Relationship Management': [5, 30],
  },
  'Office Administrator': {
    'Document Processing': [30, 85], 'Schedule/Calendar Management': [25, 88], 'Report Writing': [15, 78],
    'Customer Inquiry Handling': [15, 80], 'Client Relationship Management': [10, 32], 'Compliance/Regulation Review': [5, 65],
  },
  'Librarian': {
    'Information Retrieval': [30, 78], 'Collection Curation': [25, 62], 'Customer Inquiry Handling': [15, 72],
    'Curriculum Development': [10, 62], 'Document Processing': [10, 82], 'Student Mentoring': [10, 25],
  },
  'Radiologic Technologist': {
    'Medical Imaging Analysis': [40, 68], 'Patient Care/Nursing': [20, 18], 'Document Processing': [15, 82],
    'Treatment Planning': [10, 48], 'Compliance/Regulation Review': [10, 65], 'Report Writing': [5, 72],
  },
  'Lawyer': {
    'Legal Research': [25, 78], 'Contract Drafting': [20, 72], 'Court Representation': [20, 20],
    'Client Relationship Management': [15, 28], 'Compliance/Regulation Review': [10, 68], 'Report Writing': [10, 75],
  },
  'Financial Analyst': {
    'Financial Analysis': [35, 75], 'Report Writing': [20, 78], 'Market Valuation': [15, 72],
    'Digital Marketing': [5, 65], 'Client Relationship Management': [15, 30], 'Compliance/Regulation Review': [10, 68],
  },
  'Marketer': {
    'Digital Marketing': [30, 70], 'Creative Writing': [20, 75], 'Brand Strategy': [20, 48],
    'Report Writing': [10, 75], 'Client Relationship Management': [15, 30], 'Content Editing': [5, 68],
  },
  'Real Estate Agent': {
    'Property Showing/Consultation': [30, 30], 'Market Valuation': [20, 72], 'Sales Consultation': [20, 55],
    'Contract Drafting': [10, 72], 'Client Relationship Management': [15, 28], 'Document Processing': [5, 82],
  },
  'Pharmacist': {
    'Prescription/Dispensing': [35, 65], 'Patient Diagnosis': [15, 35], 'Client Relationship Management': [15, 28],
    'Compliance/Regulation Review': [15, 68], 'Report Writing': [10, 72], 'Treatment Planning': [10, 45],
  },
  'Teacher': {
    'Classroom Teaching': [35, 35], 'Grading/Assessment': [20, 72], 'Curriculum Development': [15, 62],
    'Student Mentoring': [15, 25], 'Report Writing': [10, 75], 'Client Relationship Management': [5, 28],
  },
  'Architect': {
    'Architectural Design': [30, 48], 'Blueprint/CAD Drawing': [25, 68], 'Site Inspection': [15, 20],
    'Client Relationship Management': [15, 28], 'Report Writing': [10, 72], 'Compliance/Regulation Review': [5, 65],
  },
  'Doctor': {
    'Patient Diagnosis': [35, 38], 'Treatment Planning': [20, 48], 'Patient Care/Nursing': [15, 18],
    'Report Writing': [10, 72], 'Medical Imaging Analysis': [10, 65], 'Client Relationship Management': [10, 25],
  },
  'Nurse': {
    'Patient Care/Nursing': [45, 18], 'Prescription/Dispensing': [15, 60], 'Report Writing': [15, 72],
    'Treatment Planning': [10, 42], 'Client Relationship Management': [10, 25], 'Emergency Response': [5, 22],
  },
  'Chef': {
    'Cooking/Food Preparation': [45, 18], 'Menu Development': [15, 42], 'Kitchen Management': [20, 35],
    'Inventory Management': [10, 72], 'Client Relationship Management': [5, 25], 'Compliance/Regulation Review': [5, 60],
  },
  'Physical Therapist': {
    'Physical Rehabilitation': [45, 15], 'Treatment Planning': [20, 48], 'Patient Care/Nursing': [15, 18],
    'Report Writing': [10, 72], 'Client Relationship Management': [10, 25],
  },
  'Government Administrator': {
    'Document Processing': [25, 82], 'Policy Research/Analysis': [20, 68], 'Civil Complaint Handling': [20, 65],
    'Report Writing': [15, 75], 'Compliance/Regulation Review': [10, 68], 'Schedule/Calendar Management': [10, 85],
  },
  'Logistics Manager': {
    'Inventory Management': [25, 72], 'Route/Delivery Planning': [25, 82], 'Report Writing': [15, 75],
    'Document Processing': [15, 82], 'Client Relationship Management': [10, 30], 'Compliance/Regulation Review': [10, 65],
  },
  'Security Guard': {
    'Surveillance/Patrol': [40, 55], 'Access Control': [25, 72], 'Emergency Response': [15, 25],
    'Report Writing': [10, 75], 'Client Relationship Management': [5, 28], 'Document Processing': [5, 80],
  },
  'Photographer': {
    'Photo Shooting': [35, 25], 'Photo Editing/Retouching': [25, 75], 'Client Relationship Management': [15, 28],
    'Digital Marketing': [10, 68], 'Storyboarding': [10, 68], 'Brand Strategy': [5, 45],
  },
  'Academy Instructor': {
    'Classroom Teaching': [35, 38], 'Curriculum Development': [20, 62], 'Grading/Assessment': [15, 72],
    'Student Mentoring': [15, 25], 'Sales Consultation': [10, 52], 'Client Relationship Management': [5, 28],
  },
};

// Salary data per occupation per country [KR (KRW), US (USD), JP (JPY)]
const SALARY_DATA = {
  'Translator/Interpreter':     [42000000, 58000, 5200000],
  'Copywriter':                 [38000000, 65000, 4800000],
  'Journalist':                 [45000000, 55000, 5500000],
  'Illustrator':                [35000000, 52000, 4200000],
  'Video Editor':               [38000000, 58000, 4500000],
  'Call Center Agent':          [28000000, 35000, 3200000],
  'Bank Teller':                [35000000, 38000, 3800000],
  'Accountant':                 [50000000, 78000, 6500000],
  'Tax Accountant':             [55000000, 72000, 7000000],
  'Insurance Agent':            [42000000, 52000, 5000000],
  'Paralegal':                  [35000000, 55000, 4200000],
  'Office Administrator':       [32000000, 42000, 3800000],
  'Librarian':                  [35000000, 52000, 4000000],
  'Radiologic Technologist':    [48000000, 68000, 5800000],
  'Lawyer':                     [85000000, 125000, 9500000],
  'Financial Analyst':          [55000000, 85000, 7200000],
  'Marketer':                   [42000000, 65000, 5200000],
  'Real Estate Agent':          [45000000, 55000, 5000000],
  'Pharmacist':                 [62000000, 130000, 6800000],
  'Teacher':                    [45000000, 62000, 5500000],
  'Architect':                  [52000000, 82000, 6200000],
  'Doctor':                     [120000000, 220000, 15000000],
  'Nurse':                      [42000000, 82000, 5000000],
  'Chef':                       [32000000, 52000, 3800000],
  'Physical Therapist':         [40000000, 92000, 5200000],
  'Government Administrator':   [45000000, 58000, 5800000],
  'Logistics Manager':          [42000000, 72000, 5500000],
  'Security Guard':             [28000000, 35000, 3200000],
  'Photographer':               [35000000, 42000, 4000000],
  'Academy Instructor':         [35000000, 48000, 4200000],
};

// Experience level overrides — multipliers for [time_pct, ai_replace_rate] relative to base
const EXPERIENCE_LEVELS = ['junior', 'mid', 'senior', 'lead'];

function getExperienceOverride(baseTime, baseAI, level) {
  // Junior: more routine tasks, higher AI vulnerability
  // Senior/Lead: more strategic tasks, lower AI vulnerability
  const mults = {
    junior:  { time: 1.0, ai: 1.15 },
    mid:     { time: 1.0, ai: 1.0 },
    senior:  { time: 1.0, ai: 0.85 },
    lead:    { time: 1.0, ai: 0.72 },
  };
  const m = mults[level];
  return {
    time_percentage: Math.round(baseTime * m.time),
    ai_replacement_rate: Math.min(98, Math.round(baseAI * m.ai)),
    ai_replacement_rate_1y: null, // will be set below
    ai_replacement_rate_3y: null,
  };
}

async function main() {
  console.log('🚀 Phase 2: Adding 30 non-IT occupations\n');

  // Step 1: Insert new tasks
  console.log('📝 Step 1: Inserting non-IT tasks...');
  const taskIdMap = {}; // name_en -> id

  for (const task of NON_IT_TASKS) {
    // Check if task already exists
    const { data: existing } = await supabase.from('tasks').select('id').eq('name_en', task.name_en).single();
    if (existing) {
      taskIdMap[task.name_en] = existing.id;
      console.log(`  ✓ ${task.name_en} (existing)`);
      continue;
    }
    
    const { data, error } = await supabase.from('tasks').insert({
      name_en: task.name_en,
      name_kr: task.name_kr,
      category: task.category,
      description: task.description,
      description_ko: task.description_ko,
      description_en: task.description_en,
      description_ja: task.description_ja,
      time_percentage: task.time_percentage,
      ai_replacement_rate: task.ai_replacement_rate,
      ai_replacement_rate_1y: task.ai_replacement_rate_1y,
      ai_replacement_rate_3y: task.ai_replacement_rate_3y,
    }).select('id').single();
    
    if (error) {
      console.error(`  ✗ ${task.name_en}: ${error.message}`);
      continue;
    }
    taskIdMap[task.name_en] = data.id;
    console.log(`  + ${task.name_en}`);
  }
  console.log(`  Total tasks mapped: ${Object.keys(taskIdMap).length}\n`);

  // Also load existing IT tasks that might be reused
  const { data: existingTasks } = await supabase.from('tasks').select('id, name_en');
  for (const t of existingTasks) {
    if (!taskIdMap[t.name_en]) taskIdMap[t.name_en] = t.id;
  }

  // Step 2: Insert occupations
  console.log('🏢 Step 2: Inserting occupations...');
  const occIdMap = {}; // name_en -> id

  for (const occ of NON_IT_OCCUPATIONS) {
    const { data: existing } = await supabase.from('occupations').select('id').eq('name_en', occ.name_en).single();
    if (existing) {
      occIdMap[occ.name_en] = existing.id;
      console.log(`  ✓ ${occ.name_en} (existing)`);
      continue;
    }

    const { data, error } = await supabase.from('occupations').insert({
      name_en: occ.name_en,
      name_ko: occ.name_ko,
      name_ja: occ.name_ja,
      ai_impact_score: occ.ai_impact_score,
    }).select('id').single();

    if (error) {
      console.error(`  ✗ ${occ.name_en}: ${error.message}`);
      continue;
    }
    occIdMap[occ.name_en] = data.id;
    console.log(`  + ${occ.name_en}`);
  }
  console.log(`  Total occupations: ${Object.keys(occIdMap).length}\n`);

  // Step 3: Insert occupation_tasks mappings
  console.log('🔗 Step 3: Mapping occupation → tasks...');
  for (const [occName, tasks] of Object.entries(OCCUPATION_TASK_MAPPINGS)) {
    const occId = occIdMap[occName];
    if (!occId) { console.error(`  ✗ Occupation not found: ${occName}`); continue; }

    for (const [taskName, [timePct, aiRate]] of Object.entries(tasks)) {
      const taskId = taskIdMap[taskName];
      if (!taskId) { console.error(`  ✗ Task not found: ${taskName}`); continue; }

      const { error } = await supabase.from('occupation_tasks').upsert({
        occupation_id: occId,
        task_id: taskId,
        time_percentage: timePct,
        ai_replacement_rate: aiRate,
      }, { onConflict: 'occupation_id,task_id' });

      if (error) console.error(`  ✗ ${occName} → ${taskName}: ${error.message}`);
    }
    console.log(`  ✓ ${occName} (${Object.keys(tasks).length} tasks)`);
  }

  // Step 4: Insert occupation_countries (salary data)
  console.log('\n💰 Step 4: Adding salary data...');
  const countries = [
    { code: 'KR', currency: 'KRW', idx: 0 },
    { code: 'US', currency: 'USD', idx: 1 },
    { code: 'JP', currency: 'JPY', idx: 2 },
  ];

  for (const [occName, salaries] of Object.entries(SALARY_DATA)) {
    const occId = occIdMap[occName];
    if (!occId) continue;

    for (const c of countries) {
      const { error } = await supabase.from('occupation_countries').upsert({
        occupation_id: occId,
        country: c.code,
        avg_salary: salaries[c.idx],
        currency: c.currency,
      }, { onConflict: 'occupation_id,country' });

      if (error) console.error(`  ✗ ${occName} ${c.code}: ${error.message}`);
    }
    console.log(`  ✓ ${occName}`);
  }

  // Step 5: Insert occupation_task_experience
  console.log('\n📊 Step 5: Adding experience level data...');
  for (const [occName, tasks] of Object.entries(OCCUPATION_TASK_MAPPINGS)) {
    const occId = occIdMap[occName];
    if (!occId) continue;

    for (const [taskName, [baseTime, baseAI]] of Object.entries(tasks)) {
      const taskId = taskIdMap[taskName];
      if (!taskId) continue;

      // Get task-level 1y/3y rates
      const taskDef = NON_IT_TASKS.find(t => t.name_en === taskName);
      const base1y = taskDef?.ai_replacement_rate_1y || Math.min(98, Math.round(baseAI * 1.08));
      const base3y = taskDef?.ai_replacement_rate_3y || Math.min(98, Math.round(baseAI * 1.18));

      for (const level of EXPERIENCE_LEVELS) {
        const override = getExperienceOverride(baseTime, baseAI, level);
        const mult = { junior: 1.15, mid: 1.0, senior: 0.85, lead: 0.72 }[level];
        
        const { error } = await supabase.from('occupation_task_experience').upsert({
          occupation_id: occId,
          task_id: taskId,
          experience_level_id: level,
          time_percentage: override.time_percentage,
          ai_replacement_rate: override.ai_replacement_rate,
          importance: Math.round(baseTime / 5), // rough importance 1-10
          ai_replacement_rate_1y: Math.min(98, Math.round(base1y * mult)),
          ai_replacement_rate_3y: Math.min(98, Math.round(base3y * mult)),
        }, { onConflict: 'occupation_id,task_id,experience_level_id' });

        if (error) console.error(`  ✗ ${occName}/${taskName}/${level}: ${error.message}`);
      }
    }
    console.log(`  ✓ ${occName}`);
  }

  console.log('\n✅ Phase 2 Step 1 complete!');
  console.log(`   Occupations: ${Object.keys(occIdMap).length}`);
  console.log(`   Tasks: ${Object.keys(taskIdMap).length}`);
  console.log('   Next: Run generate-summaries-v4-runner.mjs for new occupations');
}

main().catch(console.error);
