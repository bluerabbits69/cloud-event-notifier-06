# cloud-event-notifier-06

Azure Functions (Azure Cosmos DB trigger)  
Cosmos DBでデータの更新がされるとSlackに通知を送るサンプル  
（100本ノックの第6弾）

---

## 🚀 機能概要

- Cosmos DBに値を保存するとSlackに通知を送信します。

## 📦 ディレクトリ構成

```
cloud-event-notifier-05/
├── src/functions/
│   └── CosmosNotify.ts       # Azure Cosmos DB関数本体
├── package.json
├── host.json
├── tsconfig.json
├── local.settings.json       # Azure Functions ローカル設定
└── README.md
```

## 🚧 作成方法
### ローカルプロジェクトを作成
---
```bash
func init cloud-event-notifier-06 --worker-runtime node --language typescript
cd cloud-event-notifier-06
npm install @azure/functions
```

```
func new --name CosmosNotify --template "Azure Cosmos DB trigger"
```
すると、CosmosNotify.tsが作成されます。
```typescript
import { app, InvocationContext } from "@azure/functions";

// この関数は、Cosmos DBからのドキュメントを処理するためのAzure Functionsのハンドラーです。
// この関数は、Cosmos DBの変更をトリガーとして実行され、ドキュメントの配列を受け取ります。
// ドキュメントの配列は、Cosmos DBの変更に基づいています。
// この関数は、ドキュメントの数をログに記録するだけです。
// 実際の処理は、必要に応じて追加できます。

// CosmosNotify
// documents: Cosmos DBからのドキュメントの配列
// context: Azure FunctionsのInvocationContextオブジェクト
export async function CosmosNotify(documents: unknown[], context: InvocationContext): Promise<void> {
    context.log(`Cosmos DB function processed ${documents.length} documents`);
}

// Azure FunctionsのCosmos DBトリガーを設定します。
// connectionStringSetting: Cosmos DBの接続文字列の設定名
app.cosmosDB('CosmosNotify', {
    connectionStringSetting: '',
    databaseName: '',
    collectionName: '',
    createLeaseCollectionIfNotExists: true,
    handler: CosmosNotify
});
```

### クラウドにCosmosDBを作成する
---
1. Azure Cosmos DBデータベースアカウントを作成する。
```bash
az cosmosdb create \
	-g $RG \  # すでに作成されている場合は指定。
	-n $ACCT \  # 今回は[cosmos100knocks]にする。
	--kind GlobalDocumentDB \
	--enable-free-tier true
```
⚠️ サブスクリプションでリソースプロバイダー「Microsoft.DocumentDB」が登録されていないと失敗します。
サブスクリプション → リソースプロバイダーから登録されているか確認しましょう

作られるまで時間がかかるので気長にコーヒーでも飲んで待ちましょう☕️

### データベース・コンテナを作成する。
---
#### 📦 データベースの作成
```bash
az cosmosdb sql database create \
  -g $RG \  #リソースグループ
  -a $ACCT \ #アカウント名
  -n $DB \ #DB名（今回はappdbにする）
```

✅ 作成されると、「データエクスプローラ」で「appdb」ができている事が確認できます！

#### 🧱 コンテナの作成
```bash
# itemコンテナ
az cosmosdb sql container create \
	-g $RG \  # rg-100knocks-dev
	-a $ACCT \ # cosmos100knocks 
	-d $DB \ # appdb
	-n $CONT  \  #コンテナ名。[items]にします
  --partition-key-path "/userId" \
  --max-throughput 1000
  
# リースコンテナ
az cosmosdb sql container create \
	-g $RG \ # rg-100knocks-dev
	-a $ACCT \ # cosmos100knocks
	-d $DB \ # appdb
	-n $LEASE \ # leases（コンテナ名）
  --partition-key-path "/id" \
  --max-throughput 1000
```

✅ これも、作成されると「データエクスプローラ」で「items」「leases」ができていることが確認できます！

作成後は接続文字列を控えておきましょう
```bash
COSMOS_CONN=$(az cosmosdb keys list -g $RG -n $ACCT --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv)
echo "$COSMOS_CONN"  # 出力される接続文字列を控えておく
```

## 関数コードの修正
---
### CosmosNotify.tsを修正する。
```typescript
import { app, InvocationContext } from "@azure/functions";

export async function CosmosNotify(documents: unknown[], context: InvocationContext): Promise<void> {
    context.log(`Cosmos DB function processed ${documents.length} documents`);

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
        context.error("SLACK_WEBHOOK_URL is not set.");
        return;
    }

    if( !documents || documents.length === 0) {
        context.log("No documents to process.");
        return;
    }

    try {
        const text = 
            `🪄 Cosmos changed x${documents.length}\n` +
            // デカすぎ防止にサンプル1件だけ整形
            "sample: " + JSON.stringify(documents[0]).slice(0, 1500);

            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text })
            });
            if(!res.ok) {
                throw new Error(`Slack ${res.status}`);
            }
            context.log(`Slack notification sent successfully.`);
    } catch (error) {
        context.error(`Error sending Slack notification: ${error}`);
    }
}

app.cosmosDB('CosmosNotify', {
    connectionStringSetting: 'CosmosDB',
    databaseName: 'appdb',
    containerName: 'items',
    leaseContainerName: 'leases',
    collectionName: '',
    createLeaseCollectionIfNotExists: true,
    handler: CosmosNotify
});
```

## 💻 ローカルで動作確認
---
### local.settings.jsonに記載
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "CosmosDB": "AccountEndpoint=...;AccountKey=...;",
    "SLACK_WEBHOOK_URL": "（後でSlack連携するならここに）"
  }
}
```

### ローカルで動作確認
```bash
npm run build
func start --verbose
```

### Azure側でDBを操作
Azureポータル → CosmosDB → データエクスプローラー → items → itemsを選択し、「New Item」を選択。
```json
{
    "id": "replace_with_new_document_id",
    "userId": "replace_with_new_partition_key_value"
}
```

✅ JSON形式でデータを貼り付けて保存を押すとCosmosDBにデータが保存され、Slackに通知が飛びます！

## ☁️ デプロイして動作確認
---
### Azure上に関数アプリを生成
```bash
az functionapp create \
	-g <rg-name> \
	-n <func-name> \
	--storage-account <account_name> \
	--consumption-plan-location $LOCATION \
  --runtime node --runtime-version 20 \
  --functions-version 4
```
デプロイ!
```bash
func azure functionapp publish func-cloud-notifier-06-dev
```
⚠️ Azureの環境変数に「CosmosDB」「SLACK_WEBHOOK_URL」の設定は忘れずに！


---
## ミスったこと
* `func start --verbose`実行時にエラーが出た。
```bash
The 'CosmosNotify' function is in error: Microsoft.Azure.WebJobs.Host: Error indexing method 'Functions.CosmosNotify'. Microsoft.Azure.WebJobs.Extensions.CosmosDB: Cannot create container information for items in database appdb with lease leases in database appdb : Cosmos DB connection configuration 'CosmosDB' does not exist. Make sure that it is a defined App Setting. Microsoft.Azure.WebJobs.Extensions.CosmosDB: Cosmos DB connection configuration 'CosmosDB' does not exist. Make sure that it is a defined App Setting.
```


**【原因】**
コレはlocal.settings.jsonで接続文字列を”CosmosDB”ではなく”CosmosDBConnection”で登録していたことが原因。

接続文字列を”CosmosDB”として定義すると、エラーは出なくなった。


## 参考資料
🔗: https://learn.microsoft.com/ja-jp/azure/cosmos-db/nosql/modeling-data  
🔗: https://qiita.com/ryuichi-f/items/ea61c2d14a735bfc7f16