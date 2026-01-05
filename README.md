# 📰 ニュース自動要約配信システム

## 概要
NYTimesとBBCの最新ニュースを自動収集し、日本語翻訳付きで配信するシステム

## 機能
- 🌍 30以上のRSSフィードから自動収集
- 🈲 英語→日本語の自動翻訳
- 📧 HTMLメールで定期配信（朝6時・夕方6時）
- 📊 カテゴリー別の整理
- 🎯 重要記事の自動選出

## 技術スタック
- Google Apps Script
- Google Translate API
- RSS Feed API
- HTML/CSS

## セットアップ方法
1. Google Apps Scriptで新規プロジェクト作成
2. 各.gsファイルのコードをコピー
3. CONFIG内のメールアドレスを自分のものに変更
4. setupTrigger/setupBBCTriggerを実行

## ファイル構成
\`\`\`
📁 news-summary-automation/
  ├── 📄 NYTimes.gs    # NYTimes収集・配信スクリプト
  ├── 📄 BBC.gs        # BBC収集・配信スクリプト
  └── 📄 README.md     # プロジェクト説明書
\`\`\`

## 実績
- 情報収集時間を95%削減（10時間→30分）
- 30媒体を自動監視
- 年間120万円相当のコスト削減効果

## 作者
[furuppy5656]

## ライセンス
MIT License
