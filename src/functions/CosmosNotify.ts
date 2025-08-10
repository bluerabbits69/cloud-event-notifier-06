import { app, InvocationContext } from "@azure/functions";

// この関数は、Cosmos DBからのドキュメントを処理するためのAzure Functionsのハンドラーです。
// この関数は、Cosmos DBの変更をトリガーとして実行され、ドキュメントの配列を受け取ります。
// 受け取ったドキュメントの数をログに記録し、Slackに通知を送信します。
// SlackのWebhook URLは環境変数から取得されます。
// エラーハンドリングも含まれており、Slackへの通知が失敗した場合はエラーメッセージをログに記録します。
// 注意: このコードは、Azure FunctionsのCosmos DBトリガーを使用しており、Cosmos DBの接続文字列とSlackのWebhook URLは環境変数から取得されます。

// CosmosNotify
// documents: Cosmos DBからのドキュメントの配列
// context: Azure FunctionsのInvocationContextオブジェクト
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

// Azure FunctionsのCosmos DBトリガーを設定します。
// connectionStringSetting: Cosmos DBの接続文字列の設定名
app.cosmosDB('CosmosNotify', {
    connectionStringSetting: 'CosmosDB',
    databaseName: 'appdb',
    containerName: 'items',
    leaseContainerName: 'leases',
    collectionName: '',
    createLeaseCollectionIfNotExists: true,
    handler: CosmosNotify
});