const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 5000;

const API_URL = 'https://sun-win.onrender.com/api/history';

const predictionHistory = {
  hu: [],
  md5: []
};

const MAX_HISTORY = 100;

function normalizeResult(result) {
  if (result === 'Tài' || result === 'tài') return 'tai';
  if (result === 'Xỉu' || result === 'xỉu') return 'xiu';
  return result.toLowerCase();
}

async function fetchData() {
  try {
    const response = await axios.get(API_URL);
    return response.data;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    return null;
  }
}

function analyzeStreak(results) {
  if (results.length < 2) return { type: 'none', length: 0 };
  
  let streakType = results[0];
  let streakLength = 1;
  
  for (let i = 1; i < results.length; i++) {
    if (results[i] === streakType) {
      streakLength++;
    } else {
      break;
    }
  }
  
  return { type: streakType, length: streakLength };
}

function analyzeAlternating(results) {
  if (results.length < 4) return { isAlternating: false, length: 0 };
  
  let alternatingLength = 1;
  for (let i = 1; i < results.length; i++) {
    if (results[i] !== results[i - 1]) {
      alternatingLength++;
    } else {
      break;
    }
  }
  
  return { isAlternating: alternatingLength >= 4, length: alternatingLength };
}

function analyzeDoublePairs(results) {
  if (results.length < 8) return { isDoublePair: false };
  
  let pairCount = 0;
  let i = 0;
  while (i < results.length - 1) {
    if (results[i] === results[i + 1]) {
      pairCount++;
      i += 2;
    } else {
      break;
    }
  }
  
  return { isDoublePair: pairCount >= 2, pairCount };
}

function analyzeTriplePattern(results) {
  if (results.length < 6) return { hasTriple: false };
  
  for (let i = 0; i <= results.length - 3; i++) {
    if (results[i] === results[i + 1] && results[i + 1] === results[i + 2]) {
      return { hasTriple: true, position: i, type: results[i] };
    }
  }
  
  return { hasTriple: false };
}

function analyzeDistribution(data) {
  const taiCount = data.filter(d => d.Ket_qua === 'Tài').length;
  const xiuCount = data.length - taiCount;
  
  return {
    taiPercent: (taiCount / data.length) * 100,
    xiuPercent: (xiuCount / data.length) * 100,
    taiCount,
    xiuCount,
    total: data.length
  };
}

function analyzeDicePatterns(data) {
  const recentData = data.slice(0, 10);
  
  let highDiceCount = 0;
  let lowDiceCount = 0;
  let totalSum = 0;
  
  recentData.forEach(d => {
    const dices = [d.Xuc_xac_1, d.Xuc_xac_2, d.Xuc_xac_3];
    dices.forEach(dice => {
      if (dice >= 4) highDiceCount++;
      else lowDiceCount++;
    });
    totalSum += d.Tong;
  });
  
  return {
    highDiceRatio: highDiceCount / (highDiceCount + lowDiceCount),
    lowDiceRatio: lowDiceCount / (highDiceCount + lowDiceCount),
    averageSum: totalSum / recentData.length,
    sumTrend: totalSum / recentData.length > 10.5 ? 'high' : 'low'
  };
}

function analyzeSumTrend(data) {
  const recentSums = data.slice(0, 15).map(d => d.Tong);
  
  let increasingCount = 0;
  let decreasingCount = 0;
  
  for (let i = 0; i < recentSums.length - 1; i++) {
    if (recentSums[i] > recentSums[i + 1]) decreasingCount++;
    else if (recentSums[i] < recentSums[i + 1]) increasingCount++;
  }
  
  return {
    trend: increasingCount > decreasingCount ? 'increasing' : 'decreasing',
    strength: Math.abs(increasingCount - decreasingCount) / (recentSums.length - 1)
  };
}

function analyzeRecentWindow(results, windowSize) {
  const window = results.slice(0, windowSize);
  const taiCount = window.filter(r => r === 'Tài').length;
  return {
    taiRatio: taiCount / windowSize,
    xiuRatio: (windowSize - taiCount) / windowSize,
    dominant: taiCount > windowSize / 2 ? 'Tài' : 'Xỉu'
  };
}

function detectBridgePattern(results) {
  if (results.length < 6) return { hasBridge: false };
  
  const pattern = results.slice(0, 6);
  if (pattern[0] === pattern[1] && 
      pattern[2] !== pattern[1] && 
      pattern[3] === pattern[2] && 
      pattern[4] !== pattern[3]) {
    return { hasBridge: true, nextLikely: pattern[0] };
  }
  
  return { hasBridge: false };
}

function detectZigzagBreak(results) {
  if (results.length < 5) return { hasZigzagBreak: false };
  
  let zigzagCount = 0;
  for (let i = 0; i < 4; i++) {
    if (results[i] !== results[i + 1]) zigzagCount++;
  }
  
  if (zigzagCount >= 3 && results[0] === results[1]) {
    return { hasZigzagBreak: true, breakDirection: results[0] };
  }
  
  return { hasZigzagBreak: false };
}

function calculateAdvancedPrediction(data) {
  const last50 = data.slice(0, 50);
  const results = last50.map(d => d.Ket_qua);
  
  let prediction = '';
  let baseConfidence = 50;
  let factors = [];
  
  const streak = analyzeStreak(results);
  if (streak.length >= 4) {
    prediction = streak.type === 'Tài' ? 'Xỉu' : 'Tài';
    baseConfidence += Math.min(streak.length * 3, 15);
    factors.push(`Cầu bệt ${streak.length} phiên`);
  }
  
  const alternating = analyzeAlternating(results);
  if (alternating.isAlternating && alternating.length >= 4) {
    prediction = results[0] === 'Tài' ? 'Xỉu' : 'Tài';
    baseConfidence += Math.min(alternating.length * 2, 10);
    factors.push(`Cầu 1-1 (${alternating.length} phiên)`);
  }
  
  const doublePairs = analyzeDoublePairs(results);
  if (doublePairs.isDoublePair) {
    prediction = results[0];
    baseConfidence += 8;
    factors.push(`Cầu 2-2 (${doublePairs.pairCount} cặp)`);
  }
  
  const triple = analyzeTriplePattern(results);
  if (triple.hasTriple && triple.position === 0) {
    prediction = triple.type === 'Tài' ? 'Xỉu' : 'Tài';
    baseConfidence += 12;
    factors.push(`Cầu 3 phiên liên tiếp`);
  }
  
  const distribution = analyzeDistribution(last50);
  if (Math.abs(distribution.taiPercent - 50) > 15) {
    const dominant = distribution.taiPercent > 50 ? 'Tài' : 'Xỉu';
    const minority = dominant === 'Tài' ? 'Xỉu' : 'Tài';
    if (!prediction) prediction = minority;
    baseConfidence += 5;
    factors.push(`Phân bố lệch (${dominant}: ${distribution.taiPercent.toFixed(1)}%)`);
  }
  
  const dicePatterns = analyzeDicePatterns(last50);
  if (dicePatterns.averageSum > 11.5) {
    if (!prediction) prediction = 'Xỉu';
    baseConfidence += 3;
    factors.push(`Tổng trung bình cao (${dicePatterns.averageSum.toFixed(1)})`);
  } else if (dicePatterns.averageSum < 9.5) {
    if (!prediction) prediction = 'Tài';
    baseConfidence += 3;
    factors.push(`Tổng trung bình thấp (${dicePatterns.averageSum.toFixed(1)})`);
  }
  
  const sumTrend = analyzeSumTrend(last50);
  if (sumTrend.strength > 0.4) {
    if (!prediction) prediction = sumTrend.trend === 'increasing' ? 'Tài' : 'Xỉu';
    baseConfidence += Math.round(sumTrend.strength * 5);
    factors.push(`Xu hướng tổng ${sumTrend.trend === 'increasing' ? 'tăng' : 'giảm'}`);
  }
  
  const recentWindow5 = analyzeRecentWindow(results, 5);
  const recentWindow10 = analyzeRecentWindow(results, 10);
  
  if (Math.abs(recentWindow5.taiRatio - recentWindow10.taiRatio) > 0.3) {
    if (!prediction) prediction = recentWindow5.dominant === 'Tài' ? 'Xỉu' : 'Tài';
    baseConfidence += 4;
    factors.push('Biến động ngắn hạn');
  }
  
  const bridge = detectBridgePattern(results);
  if (bridge.hasBridge) {
    if (!prediction) prediction = bridge.nextLikely;
    baseConfidence += 6;
    factors.push('Cầu cầu đảo');
  }
  
  const zigzagBreak = detectZigzagBreak(results);
  if (zigzagBreak.hasZigzagBreak) {
    if (!prediction) prediction = zigzagBreak.breakDirection;
    baseConfidence += 5;
    factors.push('Phá cầu zigzag');
  }
  
  if (!prediction) {
    const last3Tai = results.slice(0, 3).filter(r => r === 'Tài').length;
    prediction = last3Tai >= 2 ? 'Xỉu' : 'Tài';
    factors.push('Phân tích mặc định');
  }
  
  const randomAdjust = (Math.random() * 6) - 3;
  let finalConfidence = Math.round(baseConfidence + randomAdjust);
  
  finalConfidence = Math.max(50, Math.min(85, finalConfidence));
  
  return {
    prediction,
    confidence: finalConfidence,
    factors,
    analysis: {
      streak,
      alternating,
      doublePairs,
      triple,
      distribution,
      dicePatterns,
      sumTrend,
      bridge,
      zigzagBreak
    }
  };
}

function savePrediction(type, phien, prediction, confidence) {
  const record = {
    phien: phien.toString(),
    du_doan: normalizeResult(prediction),
    ti_le: `${confidence}%`,
    id: '@mryanhdz',
    timestamp: new Date().toISOString()
  };
  
  predictionHistory[type].unshift(record);
  
  if (predictionHistory[type].length > MAX_HISTORY) {
    predictionHistory[type] = predictionHistory[type].slice(0, MAX_HISTORY);
  }
  
  return record;
}

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send('t.me/CuTools');
});

app.get('/hu', async (req, res) => {
  try {
    const data = await fetchData();
    if (!data || !data.taixiu || data.taixiu.length === 0) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    const taixiuData = data.taixiu;
    const latestPhien = taixiuData[0].Phien;
    const nextPhien = latestPhien + 1;
    
    const result = calculateAdvancedPrediction(taixiuData);
    
    const record = savePrediction('hu', nextPhien, result.prediction, result.confidence);
    
    res.json({
      phien: nextPhien.toString(),
      du_doan: normalizeResult(result.prediction),
      ti_le: `${result.confidence}%`,
      id: '@mryanhdz'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/md5', async (req, res) => {
  try {
    const data = await fetchData();
    if (!data || !data.taixiumd5 || data.taixiumd5.length === 0) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    const md5Data = data.taixiumd5;
    const latestPhien = md5Data[0].Phien;
    const nextPhien = latestPhien + 1;
    
    const result = calculateAdvancedPrediction(md5Data);
    
    const record = savePrediction('md5', nextPhien, result.prediction, result.confidence);
    
    res.json({
      phien: nextPhien.toString(),
      du_doan: normalizeResult(result.prediction),
      ti_le: `${result.confidence}%`,
      id: '@mryanhdz'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/hu/lichsu', (req, res) => {
  res.json({
    type: 'Tài Xỉu Hũ',
    history: predictionHistory.hu,
    total: predictionHistory.hu.length
  });
});

app.get('/md5/lichsu', (req, res) => {
  res.json({
    type: 'Tài Xỉu MD5',
    history: predictionHistory.md5,
    total: predictionHistory.md5.length
  });
});

app.get('/hu/analysis', async (req, res) => {
  try {
    const data = await fetchData();
    if (!data || !data.taixiu) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    const result = calculateAdvancedPrediction(data.taixiu);
    res.json({
      prediction: result.prediction,
      confidence: result.confidence,
      factors: result.factors,
      analysis: result.analysis
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.get('/md5/analysis', async (req, res) => {
  try {
    const data = await fetchData();
    if (!data || !data.taixiumd5) {
      return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
    }
    
    const result = calculateAdvancedPrediction(data.taixiumd5);
    res.json({
      prediction: result.prediction,
      confidence: result.confidence,
      factors: result.factors,
      analysis: result.analysis
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log('Endpoints:');
  console.log('  / - Homepage');
  console.log('  /hu - Dự đoán Tài Xỉu Hũ');
  console.log('  /md5 - Dự đoán Tài Xỉu MD5');
  console.log('  /hu/lichsu - Lịch sử dự đoán Hũ');
  console.log('  /md5/lichsu - Lịch sử dự đoán MD5');
  console.log('  /hu/analysis - Phân tích chi tiết Hũ');
  console.log('  /md5/analysis - Phân tích chi tiết MD5');
});
