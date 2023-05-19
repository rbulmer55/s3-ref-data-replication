#!/usr/bin/env node
import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

//Stateful
import { StatefulS3ReplicationDataStackServiceA } from '../stateful/service-a/service-a-stateful';
import { StatefulS3ReplicationDataStackServiceB } from '../stateful/service-b/service-b-stateful';
import { StatefulS3ReplicationDataStackServiceC } from '../stateful/service-c/service-c-stateful';

//Stateless
import { StatelessS3ReplicationDataStackServiceA } from '../stateless/service-a/service-a-stateless';

const app = new cdk.App();

const statefulB = new StatefulS3ReplicationDataStackServiceB(
	app,
	'S3ReplicationDataStackStatefulB',
	{}
);
const statefulC = new StatefulS3ReplicationDataStackServiceC(
	app,
	'S3ReplicationDataStackStatefulC',
	{}
);

new StatefulS3ReplicationDataStackServiceA(
	app,
	'S3ReplicationDataStackStatefulA',
	{ destinationBuckets: [statefulB.bucket, statefulC.bucket] }
);

new StatelessS3ReplicationDataStackServiceA(
	app,
	'S3ReplicationDataStackStatelessA',
	{}
);
