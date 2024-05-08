const express = require('express');
const AWS = require('aws-sdk');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

let awsConfig = {
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION,
  endpoint: process.env.ENDPOINT,
};
AWS.config.update(awsConfig);

const documentClient = new AWS.DynamoDB.DocumentClient();
const unique = [];

function getClients() {
  try {
    const params = {
      TableName: process.env.TABLE_NAME,
      Limit: 100,
      ProjectionExpression: 'clientId',
    };
    let myPromise = new Promise(async function (Resolve, Reject) {
      let allData = [];
      await documentClient.scan(params, function scanUntilDone(err, data) {
        if (err) {
          console.log(err);
          Reject(res.json({ message: 'Error fetching Data from DB ' }));
        } else {
          allData = [...allData, ...data['Items']];

          if (data.LastEvaluatedKey) {
            params.ExclusiveStartKey = data.LastEvaluatedKey;
            documentClient.scan(params, scanUntilDone);
          } else {
            console.log(allData.length);
            Resolve(allData);
          }
        }
      });
    }).then((data) => {
      const clientIds = data.map((item) => {
        return item.clientId;
      });
      const uniqueClientIds = [...new Set(clientIds)];

      return uniqueClientIds;
    });

    return myPromise;
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

app.get('/uniqueClientIds', async function getID(req, res) {
  try {
    const fd =
      req.query.fd !== '' ? new Date(req.query.fd) : new Date('1970-01-01');
    const td = req.query.td !== '' ? new Date(req.query.td) : new Date();
    const params = {
      TableName: process.env.TABLE_NAME,
      Limit: 100,
      FilterExpression: `#timestamp>=:from1 AND #timestamp<=:to1`,

      ProjectionExpression: 'clientId,#timestamp',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':from1': fd.getTime(),
        ':to1': td.getTime(),
      },
    };
    let myPromise = new Promise(async function (Resolve, Reject) {
      let allData = [];
      await documentClient.scan(params, function scanUntilDone(err, data) {
        if (err) {
          console.log(err);
          Reject(res.json({ message: 'Error fetching Data from DB ' }));
        } else {
          allData = [...allData, ...data['Items']];

          if (data.LastEvaluatedKey) {
            params.ExclusiveStartKey = data.LastEvaluatedKey;
            documentClient.scan(params, scanUntilDone);
          } else {
            console.log(allData.length);
            Resolve(allData);
          }
        }
      });

      myPromise.then((data) => {
        const countArr = new Map();
        const clientIds = data.map((item) => {
          if (countArr.has(item.clientId)) {
            countArr.set(item.clientId, countArr.get(item.clientId) + 1);
          } else {
            countArr.set(item.clientId, 1);
          }
          return item.clientId;
        });
        const uniqueClientIds = [...new Set(clientIds)];

        const clientCount = Array.from(countArr.entries()).map(
          ([id, count]) => ({
            id,
            count,
          })
        );
        console.log(clientCount);
        res.status(200).json(clientCount);
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Define the route to fetch the createdAt attribute of all items in the geonamesData table
app.get('/filter', async (req, res) => {
  const fd =
    req.query.fd !== ''
      ? new Date(req.query.fd)
      : new Date(new Date().getTime() - 120 * 24 * 60 * 60 * 1000);
  const td = req.query.td !== '' ? new Date(req.query.td) : new Date();
  const clients = req.query.clients.split(',');

  var clientObject = clients.reduce((state, term, idx) => {
    state[':client' + idx] = term;
    return state;
  }, {});

  const params = {
    TableName: process.env.TABLE_NAME,
    ProjectionExpression: 'logId,createdAt,clientId,#query,#timestamp',
    Limit: 100,
    ExpressionAttributeNames: {
      '#query': 'query',
      '#timestamp': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':from': fd.getTime(),
      ':to': td.getTime(),
    },
  };

  if (req.query.clients == '') {
    params.FilterExpression = `#timestamp>=:from AND #timestamp<=:to`;
  } else {
    var clientObject = clients.reduce((state, term, idx) => {
      state[':client' + idx] = term;
      return state;
    }, {});

    params.ExpressionAttributeValues = {
      ...params.ExpressionAttributeValues,
      ...clientObject,
    };
    params.FilterExpression = `#timestamp>=:from AND #timestamp<=:to AND clientId IN (${Object.keys(
      clientObject
    ).toString()})`;
  }

  console.time('myPromise');
  console.log('111111111111');
  console.log(params);
  let myPromise = new Promise(async function (Resolve, Reject) {
    let allData = [];
    console.log('2222222222222');
    documentClient.scan(params, function scanUntilDone(err, data) {
      console.log('-------');
      if (err) {
        console.log('09090990909090909');
        Reject(res.json({ message: 'Error fetching createdAt attribute' }));
      } else if (data['Items'].length >= 0) {
        let resp = [];
        console.log('33333333333333333');
        allData = [...allData, ...data.Items];
        console.log(allData.length);
        if (data.LastEvaluatedKey) {
          params.ExclusiveStartKey = data.LastEvaluatedKey;
          console.time('allData');
          documentClient.scan(params, scanUntilDone);
          console.timeEnd('allData');
        } else {
          console.log(allData.length);
          Resolve(allData);
        }
      }
    });
  }).then((resp) => {
    console.timeEnd('myPromise');
    return res.status(201).json(resp);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server started on port http://localhost:${port}`);
});
