#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CryptomateInfrastructureStack } from '../lib/cryptomate-infrastructure-stack';
import { CryptomateCICDStack } from '../lib/cryptomate-cicd-stack';
// import { ClientApplicationStack } from '../lib/client-application';

const envUSA = { account: '784405092080', region: 'us-west-2' };

const app = new cdk.App();
new CryptomateInfrastructureStack(app, 'CryptomateInfrastructureStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '576625574995', region: 'us-west-2' },
  env: { account: '784405092080', region: 'ap-northeast-1' },
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
// new ClientApplicationStack(app, 'Cybosture-ClientApplicationStack-dev', {
//   env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
//   domainName: process.env.DOMAIN_NAME ?? 'cybosture.yunn.tw',
//   subDomain: process.env.SUB_DOMAIN ?? 'api.dev',
// })
// new CryptomateCICDStack(app, 'CryptomateCICDStack', {env: envUSA})
