const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || "LoopBreakMemory";

async function putMemory(memory) {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: memory
  });

  await dynamodb.send(command);
  return memory;
}

async function getMemories(repoId, component) {
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
}

module.exports = {
  putMemory,
  getMemories
};