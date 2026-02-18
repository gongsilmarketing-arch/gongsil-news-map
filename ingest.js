
require('dotenv').config();
const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const https = require('https'); // 기본 모듈 사용 (axios 의존성 제거)

// axios 대신 기본 https 모듈로 간이 GET 요청 구현
function getJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
}


const parser = new Parser({
  customFields: {
    item: [
      ['georss:point', 'geoPoint'],
      ['content:encoded', 'contentEncoded']
    ],
  },
});

// 카카오 REST API 키 (사용자 제공)
const KAKAO_REST_API_KEY = '535b712ad15df457168dcab800fcb4aa';

// 수집할 RSS 피드 목록
const RSS_FEEDS = [
  { url: 'https://www.gongsilnews.com/rss/allArticle.xml', category: '전체기사' },
  { url: 'https://www.gongsilnews.com/rss/S1N1.xml', category: '공실뉴스' },
  { url: 'https://www.gongsilnews.com/rss/S1N4.xml', category: '뉴스칼럼' },
  { url: 'https://www.gongsilnews.com/rss/S1N5.xml', category: '공실스터디' }
];

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 지역명 추출을 위한 정규식 (서울/경기 주요 시/군/구 + 주요 동네)
const REGIONS = [
  // 서울 구 단위
  '강남', '서초', '송파', '강동', '용산', '성동', '광진', '동대문', '중랑', '성북', '강북', '도봉', '노원', '은평', '서대문', '마포', '양천', '강서', '구로', '금천', '영등포', '동작', '관악', '종로', '중구',
  // 경기/인천 주요 도시
  '수원', '성남', '분당', '판교', '용인', '수지', '기흥', '고양', '일산', '과천', '안양', '평촌', '군포', '산본', '의왕', '부천', '광명', '하남', '미사', '구리', '남양주', '다산', '별내', '시흥', '안산', '평택', '고덕', '화성', '동탄', '오산', '김포', '파주', '운정', '양주', '포천', '여주', '이천', '가평', '양평',
  '인천', '송도', '청라', '검단', '부평',
  // 지방 주요 도시
  '부산', '해운대', '대구', '수성', '대전', '유성', '광주', '울산', '세종', '제주',
  // 서울 주요 동네 (부동산 핫플레이스)
  '압구정', '청담', '삼성', '대치', '도곡', '개포', '일원', '수서', '반포', '잠원', '방배', '잠실', '신천', '풍납', '가락', '문정', '한남', '이태원', '보광', '동부이촌', '성수', '금호', '옥수', '왕십리', '여의도', '목동', '상계', '중계', '하계', '마곡', '흑석', '노량진', '아현', '북아현', '공덕', '상암', '연희', '한양도성'
];

// 카카오 로컬 API로 주소 검색해서 좌표 얻기
async function getCoordinates(query) {
  if (!query) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
    const headers = { 'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}` };

    const data = await getJSON(url, headers);

    if (data && data.documents && data.documents.length > 0) {
      const { x, y } = data.documents[0];
      return { lat: parseFloat(y), lng: parseFloat(x) };
    }
  } catch (error) {
    console.error(`  - Location search failed for "${query}":`, error.message);
  }
  return null;
}

// 제목에서 지역명 추출
function extractRegion(title) {
  for (const region of REGIONS) {
    if (title.includes(region)) {
      // '강남' -> '강남구' 등으로 보정해서 검색하면 정확도 UP
      // 여기선 심플하게 그대로 리턴하거나, '구' 등을 붙여봄직 함.
      return region;
    }
  }
  return null;
}


async function fetchAndStoreNews() {
  let totalNew = 0;

  for (const feedInfo of RSS_FEEDS) {
    try {
      console.log(`\nFetching [${feedInfo.category}] from: ${feedInfo.url}`);
      const feed = await parser.parseURL(feedInfo.url);
      console.log(`Found ${feed.items.length} articles.`);

      let newCount = 0;

      for (const item of feed.items) {
        const pubDate = new Date(item.pubDate);
        let lat = null;
        let lng = null;

        // 1. RSS에 좌표가 있으면 우선 사용
        if (item.geoPoint) {
          const parts = item.geoPoint.trim().split(/\s+/);
          if (parts.length === 2) {
            lat = parseFloat(parts[0]);
            lng = parseFloat(parts[1]);
          }
        }

        // 2. 좌표가 없으면 제목에서 지역명 추출하여 검색
        if (!lat || !lng) {
          const region = extractRegion(item.title);
          if (region) {
            // console.log(`  - Searching location for "${region}" (from title: ${item.title.substring(0, 15)}...)`);
            // 딜레이 살짝 (API 제한 방지)
            await new Promise(r => setTimeout(r, 100));

            const coords = await getCoordinates(region);
            if (coords) {
              lat = coords.lat;
              lng = coords.lng;
              // console.log(`    -> Found: ${lat}, ${lng}`);
            }
          }
        }

        let imageUrl = null;
        const imgMatch = item.content ? item.content.match(/<img[^>]+src="([^">]+)"/)
          : (item['content:encoded'] ? item['content:encoded'].match(/<img[^>]+src="([^">]+)"/) : null);

        if (imgMatch) {
          imageUrl = imgMatch[1];
        }

        const cleanDescription = (item.contentSnippet || item.content || '').substring(0, 300);

        const newsData = {
          title: item.title,
          link: item.link,
          description: cleanDescription,
          pub_date: pubDate.toISOString(),
          author: item.creator || '공실뉴스',
          lat: lat,
          lng: lng,
          image_url: imageUrl,
          source: 'gongsilnews',
          category: feedInfo.category
        };

        const { error } = await supabase
          .from('news')
          .upsert(newsData, { onConflict: 'link' });

        if (error) {
          // console.error(`Error: ${error.message}`);
        } else {
          process.stdout.write('.');
          newCount++;
        }
      }
      console.log(`\nProcessed ${newCount} items in ${feedInfo.category}.`);
      totalNew += newCount;

    } catch (err) {
      console.error(`Error fetching ${feedInfo.category}:`, err.message);
    }
  }

  console.log(`\nAll done! Total processed: ${totalNew}`);
}

fetchAndStoreNews();
