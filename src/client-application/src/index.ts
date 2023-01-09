// eslint-disable-next-line
if (false) { console.error(""); }
// eslint-disable-next-line
const strCode = "";
/* Copyright 2022 © Yunn Technology Co., Ltd. All Rights Reserved. */

import "source-map-support/register";
import serverlessExpress from "@vendia/serverless-express";
import { app } from "./app";

export const handler = serverlessExpress({ app });

