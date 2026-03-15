#!/usr/bin/env node

/**
 * AI Readability 위반 사항 분석 스크립트
 * 
 * 사용법:
 *   node scripts/analyze-violations.js
 * 
 * 출력:
 *   - 파일 크기 위반 목록
 *   - 함수 복잡도 위반 목록
 *   - 전체 통계
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════
// 설정
// ═══════════════════════════════════════

const MAX_LINES = 600;
const MAX_FUNCTION_LINES = 100;
const MAX_COMPLEXITY = 15;

const violations = {
  fileSize: [],
  functionSize: [],
  complexity: []
};

// ═══════════════════════════════════════
// 파일 크기 체크
// ═══════════════════════════════════════

function checkFileSize(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  
  if (lineCount > MAX_LINES) {
    violations.fileSize.push({
      file: filePath,
      lines: lineCount,
      max: MAX_LINES,
      overBy: lineCount - MAX_LINES
    });
  }
  
  return lineCount;
}

// ═══════════════════════════════════════
// 함수 길이 체크 (간단한 휴리스틱)
// ═══════════════════════════════════════

function checkFunctionSize(filePath, content) {
  const lines = content.split('\n');
  let inFunction = false;
  let functionStartLine = 0;
  let braceCount = 0;
  
  lines.forEach((line, index) => {
    // 함수 시작 감지
    if (/(function|const.*=.*\(|=>)/.test(line)) {
      if (!inFunction) {
        inFunction = true;
        functionStartLine = index + 1;
        braceCount = 0;
      }
    }
    
    // 중괄호 카운팅
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;
    
    // 함수 종료 감지
    if (inFunction && braceCount === 0 && /}/.test(line)) {
      const functionLength = index + 1 - functionStartLine;
      
      if (functionLength > MAX_FUNCTION_LINES) {
        violations.functionSize.push({
          file: filePath,
          line: functionStartLine,
          lines: functionLength,
          max: MAX_FUNCTION_LINES,
          overBy: functionLength - MAX_FUNCTION_LINES
        });
      }
      
      inFunction = false;
    }
  });
}

// ═══════════════════════════════════════
// 디렉토리 스캔
// ═══════════════════════════════════════

function scanDirectory(dir, basePath = '') {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const relativePath = path.join(basePath, file);
    const stat = fs.statSync(filePath);
    
    // 제외 디렉토리
    if (stat.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(file)) {
        continue;
      }
      scanDirectory(filePath, relativePath);
    } 
    // TypeScript/JavaScript 파일만
    else if (/\.(ts|tsx|js|jsx)$/.test(file) && !file.endsWith('.d.ts')) {
      const lineCount = checkFileSize(filePath);
      
      // 함수 크기 체크 (간단한 버전)
      const content = fs.readFileSync(filePath, 'utf8');
      checkFunctionSize(relativePath, content);
    }
  }
}

// ═══════════════════════════════════════
// 리포트 생성
// ═══════════════════════════════════════

function generateReport() {
  console.log('\n═══════════════════════════════════════');
  console.log('  AI Readability 위반 리포트');
  console.log('═══════════════════════════════════════\n');
  
  // 파일 크기 위반
  if (violations.fileSize.length > 0) {
    console.log(`📏 파일 크기 위반 (${violations.fileSize.length}건):\n`);
    violations.fileSize
      .sort((a, b) => b.overBy - a.overBy)
      .slice(0, 10)
      .forEach(v => {
        console.log(`  ${v.file}`);
        console.log(`    ${v.lines}줄 (최대 ${v.max}줄, +${v.overBy}줄 초과)`);
      });
    
    if (violations.fileSize.length > 10) {
      console.log(`\n  ... 그 외 ${violations.fileSize.length - 10}건\n`);
    }
  }
  
  // 함수 크기 위반
  if (violations.functionSize.length > 0) {
    console.log(`\n🔧 함수 길이 위반 (${violations.functionSize.length}건):\n`);
    violations.functionSize
      .sort((a, b) => b.overBy - a.overBy)
      .slice(0, 10)
      .forEach(v => {
        console.log(`  ${v.file}:${v.line}`);
        console.log(`    ${v.lines}줄 (최대 ${v.max}줄, +${v.overBy}줄 초과)`);
      });
    
    if (violations.functionSize.length > 10) {
      console.log(`\n  ... 그 외 ${violations.functionSize.length - 10}건\n`);
    }
  }
  
  // 통계
  console.log('\n═══════════════════════════════════════');
  console.log('  통계');
  console.log('═══════════════════════════════════════\n');
  console.log(`  파일 크기 위반: ${violations.fileSize.length}건`);
  console.log(`  함수 길이 위반: ${violations.functionSize.length}건`);
  
  const totalViolations = violations.fileSize.length + violations.functionSize.length;
  console.log(`\n  총 위반: ${totalViolations}건\n`);
  
  // 종료 코드
  if (totalViolations > 0) {
    console.error('❌ AI Readability 위반이 발견되었습니다.');
    process.exit(1);
  } else {
    console.log('✅ 모든 파일이 AI Readability 기준을 준수합니다.');
    process.exit(0);
  }
}

// ═══════════════════════════════════════
// 실행
// ═══════════════════════════════════════

const srcDir = path.join(process.cwd(), 'src');

if (!fs.existsSync(srcDir)) {
  console.error('❌ src 디렉토리를 찾을 수 없습니다.');
  process.exit(1);
}

console.log(`🔍 Scanning ${srcDir}...\n`);
scanDirectory(srcDir);
generateReport();
