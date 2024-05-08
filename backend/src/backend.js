// Modules import
const express = require('express');
const AWS = require('aws-sdk');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = 3001;

// App config

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//AWS configuration

let awsConfig = {
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
  region: process.env.REGION,
};
AWS.config.update(awsConfig);

const documentClient = new AWS.DynamoDB.DocumentClient();

// API for getting unique client ID's andtheir summary

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
        res.status(200).json(clientCount);
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API which accepts a logId and return the result for that logId

app.get('/showresult', async (req, res) => {
  const logId = req.query.logId;

  const params = {
    TableName: process.env.TABLE_NAME,
    Limit: 100,
    KeyConditionExpression: '#logId=:logId',
    ProjectionExpression: '#result',
    ExpressionAttributeNames: {
      '#logId': 'logId',
      '#result': 'result',
    },
    ExpressionAttributeValues: {
      ':logId': logId,
    },
  };

  let myPromise = new Promise(async function (Resolve, Reject) {
    documentClient.query(params, (err, data) => {
      if (err) {
        Reject(res.json(err));
      } else {
        Resolve(data);
      }
    });
  }).then((resp) => {
    return res.status(201).json(JSON.parse(resp.Items[0].result));
  });
});

app.get('/filter', async (req, res) => {
  const td = req.query.td !== '' ? new Date(req.query.td) : new Date();
  const fd =
    req.query.fd !== ''
      ? new Date(req.query.fd)
      : new Date(td.getTime() - 90 * 24 * 60 * 60 * 1000);

  const clients = req.query.clients.split(',');

  var clientObject = clients.reduce((state, term, idx) => {
    state[':client' + idx] = term;
    return state;
  }, {});

  const params = {
    TableName: process.env.TABLE_NAME,
    Limit: 100,

    ExpressionAttributeNames: {
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

  let myPromise = new Promise(async function (Resolve, Reject) {
    let allData = [];
    documentClient.scan(params, function scanUntilDone(err, data) {
      if (err) {
        Reject(res.json(err));
      } else if (data['Items'].length >= 0) {
        allData = [...allData, ...data.Items];
        if (data.LastEvaluatedKey) {
          params.ExclusiveStartKey = data.LastEvaluatedKey;
          documentClient.scan(params, scanUntilDone);
        } else {
          Resolve(allData);
        }
      }
    });
  }).then((resp) => {
    let result = {};
    result['resp'] = resp;

    const countArr = new Map();
    const clientIds = resp.map((item) => {
      if (countArr.has(item.clientId)) {
        countArr.set(item.clientId, countArr.get(item.clientId) + 1);
      } else {
        countArr.set(item.clientId, 1);
      }
      return item.clientId;
    });

    const clientCount = Array.from(countArr.entries()).map(([id, count]) => ({
      id,
      count,
    }));

    result['summary'] = clientCount;

    return res.status(201).json(result);
  });
});

//API used to fetch data from Database, convert to CSV, Upload to S3 and download it.

app.get('/export', async (req, res) => {
  const td = req.query.td !== '' ? new Date(req.query.td) : new Date();
  const fd =
    req.query.fd !== ''
      ? new Date(req.query.fd)
      : new Date(td.getTime() - 90 * 24 * 60 * 60 * 1000);

  const clients = req.query.clients.split(',');

  var clientObject = clients.reduce((state, term, idx) => {
    state[':client' + idx] = term;
    return state;
  }, {});

  const params = {
    TableName: process.env.TABLE_NAME,
    Limit: 100,

    ExpressionAttributeNames: {
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

  let myPromise = new Promise(async function (Resolve, Reject) {
    let allData = [];
    documentClient.scan(params, function scanUntilDone(err, data) {
      if (err) {
        Reject(res.json(err));
      } else if (data['Items'].length >= 0) {
        let resp = [];
        allData = [...allData, ...data.Items];
        if (data.LastEvaluatedKey) {
          params.ExclusiveStartKey = data.LastEvaluatedKey;
          documentClient.scan(params, scanUntilDone);
        } else {
          Resolve(allData);
        }
      }
    });
  })
    .then((resp) => {
      const header = resp
        .map((x) => Object.keys(x))
        .reduce((acc, cur) => (acc.length > cur.length ? acc : cur), []);

      let csv = resp.map((row) => {
        return header
          .map((fieldName) => {
            return JSON.stringify(row[fieldName]);
          })
          .join(',');
      });

      csv = [header.join(','), ...csv];
      csv = csv.join('\n');

      return csv;
    })
    .then((csvData) => {
      var s3 = new AWS.S3();
      const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: process.env.BUCKET_OBJECT_KEY,
        Body: csvData,
      };

      s3.upload(params, (err, data) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to upload to S3' });
        }
        const downloadLink = { link: data.Location };
        return res.status(200).send(downloadLink);
      });
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server started on port http://localhost:${port}`);
});
