import { Given, Then, When } from '@letsrunit/bdd';
import { uploadFile } from './utils/file-upload.ts';
import { expectOwnableWidgetReady } from './utils/ownable-widget.ts';
import {
  confirmLatestPendingPublicEvent,
  expectHubSnapshotRequest,
  expectHubStreamRequest,
  expectLatestHubStreamQuery,
  expectLatestWidgetActionMessage,
  expectLaterHubStreamRequest,
  expectTrackedPublicEventCount,
  expectTrackedPublicEventStatus,
  rememberCurrentOwnableId,
  resetHubTransport,
  startRecordingWidgetActionMessages,
  type PublicEventsWorld,
} from './utils/public-events-harness.ts';

Given('the Hub transport verifier backend is reset', function () {
  resetHubTransport(this as PublicEventsWorld);
});

When('the ownable widget is ready', async function () {
  await expectOwnableWidgetReady(this.page);
});

When('I start recording widget action messages', async function () {
  await startRecordingWidgetActionMessages(this.page);
});

Then(
  'the latest widget action message is an emit for {string}',
  async function (eventType: string) {
    await expectLatestWidgetActionMessage(this.page, eventType);
  }
);

When('I remember the current ownable id as {string}', async function (label: string) {
  await rememberCurrentOwnableId(this as PublicEventsWorld, label);
});

When('the Hub confirms the latest pending public event for the current ownable', async function () {
  await confirmLatestPendingPublicEvent(this.page);
});

Then('the Hub recorded a public-events snapshot request for the current ownable', async function () {
  await expectHubSnapshotRequest(this as PublicEventsWorld);
});

Then('the Hub recorded a public-events stream request for the current ownable set', async function () {
  await expectHubStreamRequest(this as PublicEventsWorld);
});

Then(
  'the Hub recorded a later public-events stream request for remembered ownables {string}',
  async function (labels: string) {
    await expectLaterHubStreamRequest(this as PublicEventsWorld, labels);
  }
);

Then(
  'the latest Hub public-events stream request uses only repeated {string} params plus {string}',
  function (idParamName: string, fromParamName: string) {
    expectLatestHubStreamQuery(
      this as PublicEventsWorld,
      idParamName,
      fromParamName
    );
  }
);

Then(
  'the tracked public-event status for the current ownable becomes {string} for {string}',
  async function (status: 'pending' | 'confirmed', eventType: string) {
    await expectTrackedPublicEventStatus(this.page, status, eventType);
  }
);

Then(
  'there is exactly {string} tracked public event for {string} on the current ownable',
  async function (countText: string, eventType: string) {
    await expectTrackedPublicEventCount(this.page, countText, eventType);
  }
);

When(
  'I upload the file {string} into the {string} file input',
  async function (filePath: string, placeholder: string) {
    await uploadFile(this.page, filePath, placeholder);
  }
);
