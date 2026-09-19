<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type { AdClientEvent, AdEventFormat, AdEventSummary, AdEventType } from '#/api';

import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  NAlert, NButton, NCard, NDataTable, NEmpty, NGrid, NGridItem, NPagination,
  NProgress, NSelect, NStatistic, NTag,
} from 'naive-ui';

import { getAdEventsApi, getAdEventSummaryApi } from '#/api';
import { formatDateTime } from '#/utils/date-time';

defineOptions({ name: 'AdMonitor' });

const route = useRoute();
const router = useRouter();
const requestState = reactive({ active: 0 });
const error = ref('');
const summary = ref<AdEventSummary>();
const rows = ref<AdClientEvent[]>([]);
const total = ref(0);
const hours = ref(24);
const format = ref<AdEventFormat | null>(null);
const eventType = ref<AdEventType | null>(null);
const page = ref(1);
const pageSize = ref(20);
let requestVersion = 0;

const hoursOptions = [
  { label: '最近 1 小时', value: 1 }, { label: '最近 24 小时', value: 24 },
  { label: '最近 7 天', value: 168 }, { label: '最近 30 天', value: 720 },
];
const formatOptions: Array<{ label: string; value: AdEventFormat }> = [
  { label: '开屏广告', value: 'SPLASH' }, { label: '信息流广告', value: 'FEED' },
  { label: '横幅广告', value: 'BANNER' },
  { label: '插全屏广告', value: 'FULL_SCREEN' }, { label: '激励视频', value: 'REWARD' },
  { label: '内容解锁', value: 'CONTENT_UNLOCK' },
];
const eventOptions: Array<{ label: string; value: AdEventType }> = [
  { label: '请求', value: 'REQUEST' }, { label: '加载成功', value: 'LOADED' },
  { label: '展示', value: 'SHOW' }, { label: '点击', value: 'CLICK' },
  { label: '关闭', value: 'CLOSE' }, { label: '失败', value: 'FAIL' },
  { label: '奖励到账', value: 'REWARD_ARRIVED' }, { label: 'eCPM 上报', value: 'ECPM' },
  { label: '不感兴趣', value: 'DISLIKE' },
];
const formatLabels = Object.fromEntries(formatOptions.map((item) => [item.value, item.label])) as Record<AdEventFormat, string>;
const eventLabels = Object.fromEntries(eventOptions.map((item) => [item.value, item.label])) as Record<AdEventType, string>;

function queryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}
function parseNumber(value: unknown, allowed: number[], fallback: number) {
  const parsed = Number(queryValue(value));
  return allowed.includes(parsed) ? parsed : fallback;
}
function syncFromUrl() {
  hours.value = parseNumber(route.query.hours, [1, 24, 168, 720], 24);
  page.value = Math.max(1, Number(queryValue(route.query.page)) || 1);
  pageSize.value = parseNumber(route.query.pageSize, [10, 20, 50, 100], 20);
  const nextFormat = queryValue(route.query.format);
  const nextEventType = queryValue(route.query.eventType);
  format.value = formatOptions.some((item) => item.value === nextFormat) ? nextFormat as AdEventFormat : null;
  eventType.value = eventOptions.some((item) => item.value === nextEventType) ? nextEventType as AdEventType : null;
}
async function load() {
  const currentVersion = ++requestVersion;
  const startedAt = Date.now();
  requestState.active += 1;
  error.value = '';
  try {
    const [summaryResult, listResult] = await Promise.all([
      getAdEventSummaryApi({ hours: hours.value, ...(format.value ? { format: format.value } : {}) }),
      getAdEventsApi({
        hours: hours.value, page: page.value, pageSize: pageSize.value,
        ...(format.value ? { format: format.value } : {}),
        ...(eventType.value ? { eventType: eventType.value } : {}),
      }),
    ]);
    if (currentVersion !== requestVersion) return;
    summary.value = summaryResult;
    rows.value = listResult.list;
    total.value = listResult.total;
  } catch (caught) {
    if (currentVersion !== requestVersion) return;
    error.value = caught instanceof Error ? caught.message : '广告监控数据加载失败，请稍后重试';
  } finally {
    const remainingIndicatorTime = 200 - (Date.now() - startedAt);
    if (remainingIndicatorTime > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, remainingIndicatorTime);
      });
    }
    requestState.active = Math.max(0, requestState.active - 1);
  }
}
function targetQuery(resetPage = false) {
  return {
    ...(hours.value === 24 ? {} : { hours: String(hours.value) }),
    ...(format.value ? { format: format.value } : {}),
    ...(eventType.value ? { eventType: eventType.value } : {}),
    ...((resetPage ? 1 : page.value) === 1 ? {} : { page: String(resetPage ? 1 : page.value) }),
    ...(pageSize.value === 20 ? {} : { pageSize: String(pageSize.value) }),
  };
}
function replaceQuery(resetPage = false) {
  void router.replace({ query: targetQuery(resetPage) });
}
function applyFilters() {
  page.value = 1;
  const query = targetQuery(true);
  if (router.resolve({ query }).fullPath === route.fullPath) {
    void load();
    return;
  }
  void router.replace({ query });
}
function changePage(value: number) {
  page.value = value;
  replaceQuery();
}
function changePageSize(value: number) {
  pageSize.value = value;
  page.value = 1;
  replaceQuery(true);
}
function eventTagType(type: AdEventType) {
  if (type === 'FAIL') return 'error';
  if (type === 'SHOW' || type === 'REWARD_ARRIVED') return 'success';
  if (type === 'LOADED') return 'info';
  if (type === 'CLICK') return 'warning';
  return 'default';
}
const columns: DataTableColumns<AdClientEvent> = [
  { key: 'createdAt', title: '发生时间', width: 180, render: (row) => formatDateTime(row.createdAt) },
  { key: 'format', title: '广告类型', width: 120, render: (row) => formatLabels[row.format] },
  { key: 'eventType', title: '事件', width: 110, render: (row) => h(NTag, { bordered: false, type: eventTagType(row.eventType) }, { default: () => eventLabels[row.eventType] }) },
  { key: 'adnName', title: '广告源', width: 120, render: (row) => row.adnName || '-' },
  { key: 'placementId', title: '广告位 ID', width: 170, ellipsis: { tooltip: true } },
  { key: 'ecpm', title: 'eCPM', width: 100, render: (row) => row.ecpm || '-' },
  { key: 'appVersion', title: 'App 版本', width: 110, render: (row) => row.appVersion || '-' },
  { key: 'errorMessage', title: '错误详情', minWidth: 260, ellipsis: { tooltip: true }, render: (row) => row.errorMessage || '-' },
];
const funnel = computed(() => {
  const totals = summary.value?.totals;
  if (!totals) return [];
  const baseline = Math.max(totals.requests, 1);
  return [
    { label: '发起请求', count: totals.requests, percentage: totals.requests ? 100 : 0 },
    { label: '加载成功', count: totals.loaded, percentage: Math.min(100, totals.loaded / baseline * 100) },
    { label: '成功展示', count: totals.shows, percentage: Math.min(100, totals.shows / baseline * 100) },
  ];
});
const failureAlert = computed(() => {
  const value = summary.value?.rates.failureRate ?? 0;
  if (value >= 20) return { type: 'error' as const, text: `当前失败率为 ${value}%，建议优先检查失败原因排行与广告位配置。` };
  if (value >= 5) return { type: 'warning' as const, text: `当前失败率为 ${value}%，建议持续观察广告源返回与网络环境。` };
  return null;
});

watch(() => route.fullPath, async () => {
  syncFromUrl();
  await load();
});
onMounted(() => {
  syncFromUrl();
  void load();
});
</script>

<template>
  <Page title="广告监控" description="查看客户端广告请求、加载、展示与失败链路；监控数据仅用于运营诊断，不参与奖励结算">
    <div class="flex flex-col gap-4">
      <NCard size="small">
        <div class="grid grid-cols-1 items-center gap-3 md:grid-cols-[160px_180px_160px_auto_auto_minmax(0,1fr)]">
          <NSelect v-model:value="hours" :options="hoursOptions" aria-label="统计时间范围" />
          <NSelect v-model:value="format" :options="formatOptions" clearable placeholder="全部广告类型" aria-label="广告类型" />
          <NSelect v-model:value="eventType" :options="eventOptions" clearable placeholder="全部事件" aria-label="事件类型" />
          <NButton type="primary" @click="applyFilters">查询</NButton>
          <NButton :loading="requestState.active > 0" @click="load">刷新</NButton>
          <span class="text-right text-xs text-gray-500 md:justify-self-end">筛选条件会保留在当前网址中</span>
        </div>
      </NCard>

      <NAlert v-if="error" type="error" title="监控数据加载失败" :bordered="false">
        <div class="flex items-center justify-between gap-4"><span>{{ error }}</span><NButton size="small" @click="load">重试</NButton></div>
      </NAlert>
      <NAlert v-else-if="failureAlert" :type="failureAlert.type" :bordered="false">{{ failureAlert.text }}</NAlert>

      <NGrid cols="1 s:2 l:4" responsive="screen" :x-gap="12" :y-gap="12">
        <NGridItem><NCard size="small"><NStatistic label="广告请求" :value="summary?.totals.requests ?? 0" /></NCard></NGridItem>
        <NGridItem><NCard size="small"><NStatistic label="加载成功" :value="summary?.totals.loaded ?? 0"><template #suffix><span class="ml-2 text-sm text-gray-500">{{ summary?.rates.loadRate ?? 0 }}%</span></template></NStatistic></NCard></NGridItem>
        <NGridItem><NCard size="small"><NStatistic label="成功展示" :value="summary?.totals.shows ?? 0"><template #suffix><span class="ml-2 text-sm text-gray-500">{{ summary?.rates.showRate ?? 0 }}%</span></template></NStatistic></NCard></NGridItem>
        <NGridItem><NCard size="small"><NStatistic label="请求失败" :value="summary?.totals.failures ?? 0"><template #suffix><span class="ml-2 text-sm" :class="summary?.totals.failures ? 'text-red-500' : 'text-gray-500'">{{ summary?.rates.failureRate ?? 0 }}%</span></template></NStatistic></NCard></NGridItem>
      </NGrid>

      <NGrid cols="1 l:5" responsive="screen" :x-gap="16" :y-gap="16">
        <NGridItem span="1 l:3">
          <NCard title="投放链路" size="small">
            <div v-if="funnel.length" class="flex flex-col gap-5 py-2">
              <div v-for="item in funnel" :key="item.label" class="grid grid-cols-[88px_1fr_72px] items-center gap-4">
                <span class="text-sm">{{ item.label }}</span>
                <NProgress type="line" :percentage="item.percentage" :show-indicator="false" :height="12" />
                <span class="text-right font-medium tabular-nums">{{ item.count }}</span>
              </div>
            </div>
            <NEmpty v-else description="当前时间范围暂无广告事件" class="py-8" />
          </NCard>
        </NGridItem>
        <NGridItem span="1 l:2">
          <NCard title="失败原因排行" size="small">
            <div v-if="summary?.failures.length" class="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
              <div v-for="item in summary.failures.slice(0, 5)" :key="`${item.format}-${item.errorMessage}`" class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <NTag size="small" :bordered="false" type="error">{{ item.count }}</NTag>
                <div class="min-w-0 flex-1"><div class="truncate text-sm" :title="item.errorMessage">{{ item.errorMessage }}</div><div class="mt-1 text-xs text-gray-500">{{ formatLabels[item.format] }} · 最近 {{ item.lastOccurredAt ? formatDateTime(item.lastOccurredAt) : '-' }}</div></div>
              </div>
            </div>
            <NEmpty v-else description="当前时间范围没有失败记录" class="py-8" />
          </NCard>
        </NGridItem>
      </NGrid>

      <NCard title="事件明细" size="small">
        <NDataTable :columns="columns" :data="rows" :loading="requestState.active > 0" :row-key="(row: AdClientEvent) => row.id" :scroll-x="1170" striped />
        <div class="mt-4 flex justify-end">
          <NPagination :page="page" :page-size="pageSize" :item-count="total" show-size-picker :page-sizes="[10, 20, 50, 100]" @update:page="changePage" @update:page-size="changePageSize" />
        </div>
      </NCard>
    </div>
  </Page>
</template>
