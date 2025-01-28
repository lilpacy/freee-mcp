# freee-mcp

freee APIをModel Context Protocol (MCP)サーバーとして提供する実装です。OpenAPI定義を使用して、freee APIのエンドポイントを自動的にMCPツールとして公開します。

⚠️ **注意**: このプロジェクトは開発中であり、予期せぬ不具合が発生する可能性があります。問題を発見された場合は、Issueとして報告していただけると幸いです。また、改善のためのプルリクエストも歓迎しています。

## 概要

このプロジェクトは以下の機能を提供します:

- freee APIのエンドポイントをMCPツールとして自動公開
- APIリクエストの自動バリデーション(Zod使用)
- エラーハンドリングとレスポンス整形

## 必要要件

- Node.js v22
- pnpm

## インストール

```bash
git clone [repository-url]
cd freee-mcp
pnpm install
```

## 環境設定

以下の環境変数を設定する必要があります:

```bash
FREEE_ACCESS_TOKEN=your_access_token
FREEE_COMPANY_ID=your_company_id
FREEE_API_URL=https://api.freee.co.jp # オプション、デフォルトはhttps://api.freee.co.jp
```

## 開発

```bash
# 開発サーバーの起動(ウォッチモード)
pnpm dev

# ビルド
pnpm build

# 型チェック
pnpm type-check

# リント
pnpm lint

# フォーマット
pnpm format
```

## 使用方法

ビルド後、以下のコマンドでサーバーを起動できます:

```bash
pnpm start
```

### MCPサーバーとしての登録

Claude デスクトップアプリケーションで使用するには、以下の設定を `~/Library/Application Support/Claude/claude_desktop_config.json` に追加してください:

```json
{
  "mcpServers": {
    "freee": {
      "command": "/usr/local/bin/node",
      "args": ["/path/to/freee-mcp/dist/index.cjs"],
      "env": {
        "FREEE_ACCESS_TOKEN": "your_access_token",
        "FREEE_COMPANY_ID": "your_company_id"
      }
    }
  }
}
```

VSCode拡張機能で使用する場合は、同様の設定を `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` に追加してください。

## 利用可能なツール

freee APIのすべてのエンドポイントがMCPツールとして自動的に公開されます

各ツールは以下の命名規則に従います:

- GET: `get_[resource_name]`
- POST: `post_[resource_name]`
- PUT: `put_[resource_name]_by_id`
- DELETE: `delete_[resource_name]_by_id`

## 技術スタック

- TypeScript
- Model Context Protocol SDK
- Zod(バリデーション)
- esbuild(ビルド)

## ライセンス

ISC

## 関連リンク

- [freee API ドキュメント](https://developer.freee.co.jp/docs)
- [Model Context Protocol](https://github.com/modelcontextprotocol)
