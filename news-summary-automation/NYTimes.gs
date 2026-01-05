// ============ 設定エリア（ここだけ編集してください）============
const CONFIG = {
  // あなたのメールアドレス
  EMAIL: "your-email@example.com",  // 要変更：自分のメールアドレスに置き換えてください
  
  // 送信時刻（24時間表記）
  SEND_HOURS: [6, 18],  // 朝6時と夕方6時
  
  // 各カテゴリーの取得記事数
  ARTICLES_PER_CATEGORY: 3,
  
  // Worldセクションの詳細記事数
  WORLD_DETAIL_ARTICLES: 2
};

// RSSフィード定義
const RSS_FEEDS = {
  'Home': 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'U.S.': 'https://rss.nytimes.com/services/xml/rss/nyt/US.xml',
  'World': 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'Business': 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
  'Arts': 'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml',
  'Opinion': 'https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml',
  'Science': 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
  'Sports': 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml',
  'Technology': 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
  'Health': 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml'
};

const WORLD_FEEDS = {
  'Africa': 'https://rss.nytimes.com/services/xml/rss/nyt/Africa.xml',
  'Americas': 'https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml',
  'Asia Pacific': 'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml',
  'Europe': 'https://rss.nytimes.com/services/xml/rss/nyt/Europe.xml',
  'Middle East': 'https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml'
};

// ============ メイン処理（編集不要）============
function setupTrigger() {
  // 既存のトリガーを削除
  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendDailySummary') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 複数の時間にトリガーを設定
  CONFIG.SEND_HOURS.forEach(hour => {
    ScriptApp.newTrigger('sendDailySummary')
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .create();
  });
  
  console.log(`設定完了！毎日${CONFIG.SEND_HOURS.join('時と')}時に配信されます。`);
}

function sendDailySummary() {
  try {
    console.log('ニュース取得開始...');
    
    // 各カテゴリーのニュースを取得
    const allCategories = {};
    const worldDetails = {};
    const allArticlesForHighlight = [];
    
    // メインカテゴリーの取得
    for (const [category, url] of Object.entries(RSS_FEEDS)) {
      console.log(`${category}を取得中...`);
      const articles = fetchArticles(url, CONFIG.ARTICLES_PER_CATEGORY);
      if (articles.length > 0) {
        allCategories[category] = articles;
        allArticlesForHighlight.push(...articles.map(a => ({...a, category})));
      }
    }
    
    // Worldセクションの詳細取得
    for (const [region, url] of Object.entries(WORLD_FEEDS)) {
      console.log(`World - ${region}を取得中...`);
      const articles = fetchArticles(url, CONFIG.WORLD_DETAIL_ARTICLES);
      if (articles.length > 0) {
        worldDetails[region] = articles;
        allArticlesForHighlight.push(...articles.map(a => ({...a, category: `World - ${region}`})));
      }
    }
    
    // 興味深いトピックの選出
    const highlights = selectHighlights(allArticlesForHighlight);
    
    console.log('メール作成中...');
    const emailContent = createComprehensiveEmail(allCategories, worldDetails, highlights);
    
    console.log('メール送信中...');
    sendEmail(emailContent);
    
    console.log('完了！');
  } catch (error) {
    console.error('エラー発生:', error);
    MailApp.sendEmail(
      CONFIG.EMAIL,
      'NYTimes Summary - エラー通知',
      'エラーが発生しました: ' + error.toString()
    );
  }
}

function fetchArticles(rssUrl, maxArticles) {
  try {
    const response = UrlFetchApp.fetch(rssUrl);
    const xml = response.getContentText();
    
    const document = XmlService.parse(xml);
    const root = document.getRootElement();
    const channel = root.getChild('channel');
    const items = channel.getChildren('item');
    
    return items.slice(0, maxArticles).map(item => {
      // メディア情報の取得
      const mediaContent = item.getChild('content', XmlService.getNamespace('media'));
      let imageUrl = '';
      if (mediaContent) {
        imageUrl = mediaContent.getAttribute('url')?.getValue() || '';
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
    console.error(`フィード取得エラー (${rssUrl}):`, error);
    return [];
  }
}

function translateToJapanese(text) {
  // Google翻訳APIを使用（無料枠内）
  try {
    Utilities.sleep(1100); // API制限対策
    const translated = LanguageApp.translate(text, 'en', 'ja');
    return translated;
  } catch (error) {
    console.error('翻訳エラー:', error);
    // エラーの場合は簡易的な説明を返す
    return '※この記事の日本語翻訳は現在利用できません。英語版をご確認ください。';
  }
}

function generateBilingualSummary(article, skipTranslation = false) {
  // 英語版の要約
  const englishSummary = article.description;
  
  // 日本語版の要約（Google翻訳を使用）
  let japaneseTitle = '';
  let japaneseSummary = '';
  
  if (!skipTranslation) {
    try {
      // タイトルと説明文を一度に翻訳（API呼び出し削減）
      const combinedText = article.title + '\n---SEPARATOR---\n' + article.description;
      const translatedText = translateToJapanese(combinedText);
      const parts = translatedText.split('\n---SEPARATOR---\n');
      
      japaneseTitle = parts[0] || article.title;
      japaneseSummary = parts[1] || article.description;
    } catch (error) {
      japaneseTitle = article.title;
      japaneseSummary = '※日本語翻訳を生成できませんでした。';
    }
  } else {
    japaneseTitle = article.title;
    japaneseSummary = article.description;
  }
  
  const japaneseContent = `
【タイトル】${japaneseTitle}
【概要】${japaneseSummary}
【公開日】${article.pubDate}
`;
  
  return {
    english: englishSummary,
    japanese: japaneseContent,
    link: article.link
  };
}

function selectHighlights(allArticles) {
  // 記事をランダムにシャッフルして興味深いものを選出
  const shuffled = allArticles.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 5);
  
  return selected.map(article => ({
    ...article,
    reason: `カテゴリー「${article.category}」からの注目記事`
  }));
}

function createComprehensiveEmail(categories, worldDetails, highlights) {
  const today = new Date().toLocaleDateString('ja-JP');
  
  let html = `
    <html>
      <head>
        <style>
          body { 
            font-family: 'Helvetica Neue', 'Noto Sans JP', Arial, sans-serif; 
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 { 
            color: #000;
            border-bottom: 3px solid #326891;
            padding-bottom: 10px;
          }
          h2 {
            color: #326891;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin-top: 30px;
          }
          h3 {
            color: #666;
            margin-top: 20px;
          }
          .category-section {
            margin: 30px 0;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 8px;
          }
          .article { 
            margin: 15px 0; 
            padding: 15px;
            background: #fff;
            border-left: 3px solid #326891;
            border-radius: 4px;
          }
          .article-title { 
            font-size: 16px;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 8px;
          }
          .bilingual-summary {
            margin: 10px 0;
          }
          .english-summary {
            padding: 10px;
            background: #f0f8ff;
            border-radius: 4px;
            margin-bottom: 8px;
            font-style: italic;
          }
          .japanese-summary {
            padding: 10px;
            background: #fffaf0;
            border-radius: 4px;
            white-space: pre-line;
          }
          .read-more { 
            display: inline-block;
            color: #326891;
            text-decoration: none;
            font-weight: bold;
            margin-top: 8px;
            padding: 5px 10px;
            background: #e8f4ff;
            border-radius: 4px;
          }
          .read-more:hover {
            background: #d0e8ff;
          }
          .highlight-box {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .highlight-reason {
            color: #856404;
            font-size: 14px;
            margin-bottom: 5px;
          }
          .world-detail {
            background: #e8f5e9;
            border-left: 4px solid #4caf50;
            margin: 10px 0;
            padding: 10px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
          }
          .toc {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .toc-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
          .toc-item {
            margin: 5px 0;
            color: #326891;
          }
        </style>
      </head>
      <body>
        <h1>📰 NYTimes デイリーサマリー - ${today}</h1>
        
        <div class="toc">
          <div class="toc-title">📋 目次</div>
          <div class="toc-item">• 今日の注目トピック</div>
          <div class="toc-item">• 各セクション要約</div>
          <div class="toc-item">• World詳細レポート</div>
        </div>
        
        <h2>🌟 今日の注目トピック</h2>
  `;
  
  // ハイライト記事（翻訳制限対策）
  let translationCount = 0;
  highlights.forEach((article, index) => {
    const skipTranslation = translationCount > 5;
    const summary = generateBilingualSummary(article, skipTranslation);
    translationCount++;
    
    html += `
      <div class="highlight-box">
        <div class="highlight-reason">🏆 選出理由: ${article.reason}</div>
        <div class="article-title">${index + 1}. ${article.title}</div>
        <div class="bilingual-summary">
          <div class="english-summary">
            <strong>English:</strong> ${summary.english}
          </div>
          <div class="japanese-summary">
            <strong>日本語:</strong> ${summary.japanese}
          </div>
        </div>
        <a href="${summary.link}" class="read-more" target="_blank">
          📖 記事全文を読む / Read Full Article →
        </a>
      </div>
    `;
  });
  
  html += '<h2>📂 各セクション要約</h2>';
  
  // 各カテゴリーの記事
  for (const [category, articles] of Object.entries(categories)) {
    html += `
      <div class="category-section">
        <h3>【${category}】</h3>
    `;
    
    articles.forEach((article, index) => {
      const skipTranslation = translationCount > 20;
      const summary = generateBilingualSummary(article, skipTranslation);
      translationCount++;
      
      html += `
        <div class="article">
          <div class="article-title">${index + 1}. ${article.title}</div>
          <div class="bilingual-summary">
            <div class="english-summary">
              <strong>EN:</strong> ${summary.english}
            </div>
            <div class="japanese-summary">
              <strong>JP:</strong> ${summary.japanese}
            </div>
          </div>
          <a href="${summary.link}" class="read-more" target="_blank">
            🔗 Full Article →
          </a>
        </div>
      `;
    });
    
    html += '</div>';
  }
  
  // World詳細セクション
  html += '<h2>🌍 World詳細レポート</h2>';
  
  for (const [region, articles] of Object.entries(worldDetails)) {
    html += `
      <div class="world-detail">
        <h3>📍 ${region}</h3>
    `;
    
    articles.forEach((article, index) => {
      const skipTranslation = translationCount > 30;
      const summary = generateBilingualSummary(article, skipTranslation);
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
            詳細を見る →
          </a>
        </div>
      `;
    });
    
    html += '</div>';
  }
  
  html += `
        <div class="footer">
          <p>このメールは自動生成されています。</p>
          <p>配信停止をご希望の場合は、Google Apps Scriptのトリガーを削除してください。</p>
        </div>
      </body>
    </html>
  `;
  
  return html;
}

function sendEmail(htmlContent) {
  MailApp.sendEmail({
    to: CONFIG.EMAIL,
    subject: `📰 NYTimes 総合サマリー - ${new Date().toLocaleDateString('ja-JP')}`,
    htmlBody: htmlContent
  });
}

// テスト実行用
function testRun() {
  sendDailySummary();
}