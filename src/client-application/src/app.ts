import cors from "cors";
import express from "express";
import { Request, Response } from "express";
import compression from "compression";
import AWS from "aws-sdk";
import { getLogger } from "log4js";
import morganBody from "morgan-body";

const {
  AWS_DEFAULT_REGION,
  TEST
} = process.env;

const whitelist = ['http://localhost:3000'];

const app = express();
const router = express.Router();

export const logger = getLogger("api");

export const corsOptions = {
  optionsSuccessStatus: 200,
  credentials: true
};

export const dynamoDB = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: AWS_DEFAULT_REGION,
});

export const ecs = new AWS.ECS({
  apiVersion: '2014-11-13',
  region: AWS_DEFAULT_REGION,
})

export async function getParameterStoreValue(name: string) {
  const params = {
    Name: name,
    WithDecryption: true
  };
  const result = await paramStore.getParameter(params).promise();
  return result.Parameter?.Value;
}

const paramStore = new AWS.SSM({
  region: AWS_DEFAULT_REGION
});

app.use(cors({
  origin: (origin, callback) => {
    if (origin && whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else if (!origin) {
      callback(null, true)
    } else {
      callback(new Error())
    }
  },
  ...corsOptions
}
));

app.use(express.json());
morganBody(app, {
  stream: {
    write: (message: any) => {
      logger.trace(message);
      return true
    },
  },
  prettify: false,
  logReqDateTime: false
});

router.use(compression());
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

if (TEST) {
  logger.level = "all"
  app.use("/client", router);
  app.listen(3000, () => {
    logger.info("STARTED ON 3000")
  })
} else {
  logger.level = "info"
  app.use("/", router);
}

export { app };
