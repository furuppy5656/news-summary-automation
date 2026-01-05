// ============ 設定エリア（ここだけ編集してください）============
const BBC_CONFIG = {
  // あなたのメールアドレス
  EMAIL: "your-email@example.com",  // 要変更：自分のメールアドレスに置き換えてください
  
  // 送信時刻（24時間表記）
  SEND_HOURS: [6, 18],  // 朝6時と夕方6時
  
  // 各カテゴリーの取得記事数
  ARTICLES_PER_CATEGORY: 2,  // 翻訳API制限対策のため削減
  
  // 詳細セクションの記事数
  DETAIL_ARTICLES: 3  // 翻訳API制限対策のため削減
};

// BBC RSSフィード定義
const BBC_FEEDS = {
  'World': 'http://feeds.bbci.co.uk/news/world/rss.xml',
  'UK': 'http://feeds.bbci.co.uk/news/uk/rss.xml',
  'Business': 'http://feeds.bbci.co.uk/news/business/rss.xml',
  'Politics': 'http://feeds.bbci.co.uk/news/politics/rss.xml',
  'Health': 'http://feeds.bbci.co.uk/news/health/rss.xml',
  'Science & Environment': 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  'Technology': 'http://feeds.bbci.co.uk/news/technology/rss.xml',
  'Entertainment & Arts': 'http://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml'
};

// 地域別フィード
const BBC_REGIONAL_FEEDS = {
  'Asia': 'http://feeds.bbci.co.uk/news/world/asia/rss.xml',
  'Africa': 'http://feeds.bbci.co.uk/news/world/africa/rss.xml',
  'Europe': 'http://feeds.bbci.co.uk/news/world/europe/rss.xml',
  'Middle East': 'http://feeds.bbci.co.uk/news/world/middle_east/rss.xml',
  'US & Canada': 'http://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml',
  'Latin America': 'http://feeds.bbci.co.uk/news/world/latin_america/rss.xml',
  'Australia': 'http://feeds.bbci.co.uk/news/world/australia/rss.xml'
};

// 詳細取得セクション
const BBC_DETAIL_SECTIONS = {
  'Health (詳細)': 'http://feeds.bbci.co.uk/news/health/rss.xml',
  'Science & Environment (詳細)': 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
  'Technology (詳細)': 'http://feeds.bbci.co.uk/news/technology/rss.xml',
  'Asia (詳細)': 'http://feeds.bbci.co.uk/news/world/asia/rss.xml'
};

// ============ BBC用メイン処理 ============
function setupBBCTrigger() {
  // 既存のBBCトリガーを削除
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendBBCDailySummary') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 複数の時間にトリガーを設定
  BBC_CONFIG.SEND_HOURS.forEach(hour => {
    ScriptApp.newTrigger('sendBBCDailySummary')
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .create();
  });
  
  console.log(`BBC設定完了！毎日${BBC_CONFIG.SEND_HOURS.join('時と')}時に配信されます。`);
}

function sendBBCDailySummary() {
  try {
    console.log('BBC ニュース取得開始...');
    
    const allCategories = {};
    const regionalNews = {};
    const detailSections = {};
    const allArticlesForHighlight = [];
    
    // メインカテゴリーの取得
    for (const [category, url] of Object.entries(BBC_FEEDS)) {
      console.log(`BBC ${category}を取得中...`);
      const articles = fetchBBCArticles(url, BBC_CONFIG.ARTICLES_PER_CATEGORY);
      if (articles.length > 0) {
        allCategories[category] = articles;
        allArticlesForHighlight.push(...articles.map(a => ({...a, category})));
      }
    }
    
    // 地域別ニュースの取得
    for (const [region, url] of Object.entries(BBC_REGIONAL_FEEDS)) {
      console.log(`BBC ${region}を取得中...`);
      const articles = fetchBBCArticles(url, BBC_CONFIG.ARTICLES_PER_CATEGORY);
      if (articles.length > 0) {
        regionalNews[region] = articles;
        allArticlesForHighlight.push(...articles.map(a => ({...a, category: region})));
      }
    }
    
    // 詳細セクションの取得
    for (const [section, url] of Object.entries(BBC_DETAIL_SECTIONS)) {
      console.log(`BBC ${section}を取得中...`);
      const articles = fetchBBCArticles(url, BBC_CONFIG.DETAIL_ARTICLES);
      if (articles.length > 0) {
        detailSections[section] = articles;
      }
    }
    
    // 興味深いトピックの選出
    const highlights = selectBBCHighlights(allArticlesForHighlight);
    
    console.log('BBCメール作成中...');
    const emailContent = createBBCEmail(allCategories, regionalNews, detailSections, highlights);
    
    console.log('BBCメール送信中...');
    sendBBCEmail(emailContent);
    
    console.log('BBC配信完了！');
  } catch (error) {
    console.error('BBCエラー発生:', error);
    MailApp.sendEmail(
      BBC_CONFIG.EMAIL,
      'BBC Summary - エラー通知',
      'エラーが発生しました: ' + error.toString()
    );
  }
}

function fetchBBCArticles(rssUrl, maxArticles) {
  try {
    const response = UrlFetchApp.fetch(rssUrl);
    const xml = response.getContentText();
    
    const document = XmlService.parse(xml);
    const root = document.getRootElement();
    const channel = root.getChild('channel');
    const items = channel.getChildren('item');
    
    return items.slice(0, maxArticles).map(item => {
      // サムネイル画像の取得
      let imageUrl = '';
      const thumbnail = item.getChild('thumbnail', XmlService.getNamespace('media'));
      if (thumbnail) {
        imageUrl = thumbnail.getAttribute('url')?.getValue() || '';
      }
      
      return {
        title: item.getChild('title').getText(),
        link: item.getChild('link').getText(),
        description: item.getChild('description').getText(),
        pubDate: item.getChild('pubDate').getText(),
        image: imageUrl
      };
    });
  } catch (error) {
    console.error(`BBCフィード取得エラー (${rssUrl}):`, error);
    return [];
  }
}

function translateBBC(text) {
  try {
    Utilities.sleep(1100); // 翻訳API呼び出し前に1.1秒待機（レート制限対策）
    const translated = LanguageApp.translate(text, 'en', 'ja');
    return translated;
  } catch (error) {
    console.error('翻訳エラー:', error);
    return '※翻訳エラー：英語版をご確認ください。';
  }
}

function generateBBCBilingualSummary(article, skipTranslation = false) {
  const englishSummary = article.description;
  
  let japaneseTitle = '';
  let japaneseSummary = '';
  
  if (!skipTranslation) {
    try {
      // タイトルと説明文を一度に翻訳（API呼び出し回数削減）
      const combinedText = article.title + '\n---SEPARATOR---\n' + article.description;
      const translatedText = translateBBC(combinedText);
      const parts = translatedText.split('\n---SEPARATOR---\n');
      
      japaneseTitle = parts[0] || article.title;
      japaneseSummary = parts[1] || article.description;
    } catch (error) {
      japaneseTitle = article.title;
      japaneseSummary = '※日本語翻訳を生成できませんでした。';
    }
  } else {
    // 翻訳をスキップ（API制限対策）
    japaneseTitle = article.title;
    japaneseSummary = article.description;
  }
  
  const japaneseContent = `
【タイトル】${japaneseTitle}
【概要】${japaneseSummary}
【配信日時】${article.pubDate}
`;
  
  return {
    english: englishSummary,
    japanese: japaneseContent,
    link: article.link,
    image: article.image
  };
}

function selectBBCHighlights(allArticles) {
  // ランダムに記事を選出して重要トピックとする
  const shuffled = allArticles.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);  // TOP 3記事を選出
  
  return selected.map(article => ({
    ...article,
    reason: `BBC ${article.category}からの重要ニュース`
  }));
}

function createBBCEmail(categories, regional, detailed, highlights) {
  const today = new Date().toLocaleDateString('ja-JP');
  
  let html = `
    <html>
      <head>
        <style>
          body { 
            font-family: 'Arial', 'Helvetica Neue', 'Noto Sans JP', sans-serif; 
            line-height: 1.7;
            color: #333;
            max-width: 850px;
            margin: 0 auto;
            padding: 20px;
            background: #fafafa;
          }
          h1 { 
            color: #bb1919;
            border-bottom: 4px solid #bb1919;
            padding-bottom: 10px;
            font-size: 28px;
          }
          h2 {
            color: #bb1919;
            border-bottom: 2px solid #ddd;
            padding-bottom: 5px;
            margin-top: 35px;
            font-size: 22px;
          }
          h3 {
            color: #555;
            margin-top: 20px;
            font-size: 18px;
            background: #f0f0f0;
            padding: 8px;
            border-left: 3px solid #bb1919;
          }
          .category-section {
            margin: 25px 0;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .article { 
            margin: 15px 0; 
            padding: 15px;
            background: #fff;
            border-left: 3px solid #bb1919;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .article-title { 
            font-size: 16px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 10px;
          }
          .article-image {
            max-width: 200px;
            height: auto;
            float: right;
            margin: 0 0 10px 15px;
            border-radius: 4px;
          }
          .bilingual-summary {
            margin: 10px 0;
            clear: both;
          }
          .english-summary {
            padding: 12px;
            background: #f8f8f8;
            border-radius: 4px;
            margin-bottom: 8px;
            border-left: 3px solid #1e70bf;
          }
          .japanese-summary {
            padding: 12px;
            background: #fff5f5;
            border-radius: 4px;
            white-space: pre-line;
            border-left: 3px solid #dc3545;
          }
          .read-more { 
            display: inline-block;
            color: white;
            background: #bb1919;
            text-decoration: none;
            font-weight: bold;
            margin-top: 10px;
            padding: 8px 15px;
            border-radius: 4px;
            transition: background 0.3s;
          }
          .read-more:hover {
            background: #991515;
          }
          .highlight-box {
            background: linear-gradient(135deg, #fff3cd 0%, #ffe5b4 100%);
            border: 2px solid #ff6b6b;
            border-radius: 10px;
            padding: 18px;
            margin: 25px 0;
            box-shadow: 0 3px 6px rgba(0,0,0,0.1);
          }
          .highlight-reason {
            color: #d73502;
            font-size: 14px;
            margin-bottom: 8px;
            font-weight: bold;
          }
          .detail-section {
            background: #e8f4fd;
            border-left: 5px solid #1e70bf;
            margin: 15px 0;
            padding: 15px;
            border-radius: 4px;
          }
          .regional-section {
            background: #f0f9ff;
            border: 1px solid #b3d9ff;
            margin: 10px 0;
            padding: 12px;
            border-radius: 6px;
          }
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #bb1919;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
          .toc {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .toc-title {
            font-weight: bold;
            margin-bottom: 12px;
            color: #bb1919;
            font-size: 16px;
          }
          .toc-item {
            margin: 8px 0;
            color: #555;
            padding-left: 20px;
          }
          .bbc-logo {
            font-weight: bold;
            color: #bb1919;
            font-size: 24px;
          }
        </style>
      </head>
      <body>
        <h1><span class="bbc-logo">BBC</span> News デイリーサマリー - ${today}</h1>
        
        <div class="toc">
          <div class="toc-title">📋 本日のコンテンツ</div>
          <div class="toc-item">• 🌟 今日の注目トピック</div>
          <div class="toc-item">• 📰 メインカテゴリーニュース</div>
          <div class="toc-item">• 🌍 地域別ニュース</div>
          <div class="toc-item">• 🔍 詳細レポート（Health/Science/Tech/Asia）</div>
        </div>
        
        <h2>🌟 今日の注目トピック TOP 3</h2>
  `;
  
  // ハイライト記事
  highlights.forEach((article, index) => {
    const summary = generateBBCBilingualSummary(article);
    html += `
      <div class="highlight-box">
        <div class="highlight-reason">🏆 ${article.reason}</div>
        <div class="article-title">No.${index + 1}: ${article.title}</div>
        ${summary.image ? `<img src="${summary.image}" class="article-image" alt="${article.title}">` : ''}
        <div class="bilingual-summary">
          <div class="english-summary">
            <strong>🇬🇧 English:</strong><br>${summary.english}
          </div>
          <div class="japanese-summary">
            <strong>🇯🇵 日本語:</strong>${summary.japanese}
          </div>
        </div>
        <a href="${summary.link}" class="read-more" target="_blank">
          BBC原文を読む →
        </a>
      </div>
    `;
  });
  
  // メインカテゴリー
  html += '<h2>📰 メインカテゴリーニュース</h2>';
  
  let translationCount = 0;
  for (const [category, articles] of Object.entries(categories)) {
    html += `
      <div class="category-section">
        <h3>【${category}】</h3>
    `;
    
    articles.forEach((article, index) => {
      // 翻訳制限対策：最初の20記事のみ翻訳
      const skipTranslation = translationCount > 20;
      const summary = generateBBCBilingualSummary(article, skipTranslation);
      translationCount++;
      
      html += `
        <div class="article">
          <div class="article-title">${index + 1}. ${article.title}</div>
          ${summary.image ? `<img src="${summary.image}" class="article-image" alt="${article.title}">` : ''}
          <div class="bilingual-summary">
            <div class="english-summary">
              <strong>EN:</strong> ${summary.english}
            </div>
            <div class="japanese-summary">
              <strong>JP:</strong> ${summary.japanese}
            </div>
          </div>
          <a href="${summary.link}" class="read-more" target="_blank">
            Read More →
          </a>
        </div>
      `;
    });
    
    html += '</div>';
  }
  
  // 地域別ニュース
  html += '<h2>🌍 地域別ニュース</h2>';
  
  for (const [region, articles] of Object.entries(regional)) {
    html += `
      <div class="regional-section">
        <h3>📍 ${region}</h3>
    `;
    
    articles.forEach((article, index) => {
      // 翻訳制限対策
      const skipTranslation = translationCount > 30;
      const summary = generateBBCBilingualSummary(article, skipTranslation);
      translationCount++;
      
      html += `
        <div class="article">
          <div class="article-title">${index + 1}. ${article.title}</div>
          <div class="bilingual-summary">
            <div class="english-summary">
              ${summary.english}
            </div>
            <div class="japanese-summary">
              ${summary.japanese}
            </div>
          </div>
          <a href="${summary.link}" class="read-more" target="_blank">
            詳細 →
          </a>
        </div>
      `;
    });
    
    html += '</div>';
  }
  
  // 詳細セクション
  html += '<h2>🔍 詳細レポート</h2>';
  
  for (const [section, articles] of Object.entries(detailed)) {
    html += `
      <div class="detail-section">
        <h3>【${section}】</h3>
    `;
    
    articles.forEach((article, index) => {
      // 翻訳制限対策
      const skipTranslation = translationCount > 40;
      const summary = generateBBCBilingualSummary(article, skipTranslation);
      translationCount++;
      
      html += `
        <div class="article">
          <div class="article-title">${index + 1}. ${article.title}</div>
          ${summary.image ? `<img src="${summary.image}" class="article-image" alt="${article.title}">` : ''}
          <div class="bilingual-summary">
            <div class="english-summary">
              <strong>English:</strong><br>${summary.english}
            </div>
            <div class="japanese-summary">
              <strong>日本語:</strong>${summary.japanese}
            </div>
          </div>
          <a href="${summary.link}" class="read-more" target="_blank">
            BBC記事へ →
          </a>
        </div>
      `;
    });
    
    html += '</div>';
  }
  
  html += `
        <div class="footer">
          <p><strong>BBC News</strong> 自動要約システム</p>
          <p>このメールは毎日${BBC_CONFIG.SEND_HOURS.join('時と')}時に自動配信されています。</p>
          <p>配信停止：Google Apps Scriptのトリガーから「sendBBCDailySummary」を削除してください。</p>
        </div>
      </body>
    </html>
  `;
  
  return html;
}

function sendBBCEmail(htmlContent) {
  MailApp.sendEmail({
    to: BBC_CONFIG.EMAIL,
    subject: `📺 BBC News 総合サマリー - ${new Date().toLocaleDateString('ja-JP')}`,
    htmlBody: htmlContent
  });
}

// BBCテスト実行用
function testBBC() {
  sendBBCDailySummary();
}