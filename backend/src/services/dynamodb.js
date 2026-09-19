const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

const DEFAULT_REGION = "eu-north-1";
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || DEFAULT_REGION
});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "LoopBreakMemory";

const inMemoryStore = [];

async function putMemory(memory) {
  if (process.env.LOOPBREAK_LOCAL_MEMORY === "true") {
    inMemoryStore.unshift(memory);
    return memory;
  }

  try {
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: memory
    });

    await dynamodb.send(command);
    return memory;
  } catch (err) {
    if (
      err.name === "CredentialsProviderError" ||
      err.message?.includes("Could not load credentials") ||
      err.message?.includes("Region is missing")
    ) {
      console.warn(
        "DynamoDB AWS credentials/region not found. Using local store for memory persistence."
      );
      inMemoryStore.unshift(memory);
      return memory;
    }
    throw err;
  }
}

async function getMemories(repoId, component) {
  if (process.env.LOOPBREAK_LOCAL_MEMORY === "true") {
    return inMemoryStore.filter(m => m.PK === `${repoId}#${component}`);
  }

  try {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `${repoId}#${component}`
      },
      ScanIndexForward: false
    });

    const result = await dynamodb.send(command);
    return result.Items || [];
  } catch (err) {
    if (
      err.name === "CredentialsProviderError" ||
      err.message?.includes("Could not load credentials") ||
      err.message?.includes("Region is missing")
    ) {
      console.warn(
        "DynamoDB AWS credentials/region not found. Querying local store for memory recall."
      );
      return inMemoryStore.filter(m => m.PK === `${repoId}#${component}`);
    }
    throw err;
  }
}

module.exports = {
  putMemory,
  getMemories
};