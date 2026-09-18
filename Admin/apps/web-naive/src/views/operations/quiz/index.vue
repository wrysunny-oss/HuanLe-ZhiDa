<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui';

import type {
  QuizCategory,
  QuizPublishStatus,
  QuizQuestion,
  QuizQuestionListResult,
  QuizReviewStatus,
} from '#/api';

import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPagination,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NStatistic,
  NTag,
  useDialog,
  useMessage,
} from 'naive-ui';

import {
  bulkReviewQuizQuestionsApi,
  getQuizQuestionsApi,
  reviewQuizQuestionApi,
  updateQuizQuestionApi,
  updateQuizQuestionStatusApi,
} from '#/api';

defineOptions({ name: 'QuizQuestions' });

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const { hasAccessByCodes } = useAccess();
const canUpdate = hasAccessByCodes(['content:update']);

const rows = ref<QuizQuestion[]>([]);
const categories = ref<QuizCategory[]>([]);
const summary = ref<QuizQuestionListResult['summary']>({ reviewGroups: [], statusGroups: [] });
const loading = ref(false);
const saving = ref(false);
const page = ref(Number(route.query.page) || 1);
const pageSize = ref(Number(route.query.pageSize) || 20);
const total = ref(0);
const keyword = ref(typeof route.query.keyword === 'string' ? route.query.keyword : '');
const statusFilter = ref<'' | QuizPublishStatus>((route.query.status as QuizPublishStatus) || '');
const reviewFilter = ref<'' | QuizReviewStatus>((route.query.reviewStatus as QuizReviewStatus) || '');
const categoryFilter = ref(typeof route.query.categoryId === 'string' ? route.query.categoryId : '');
const checkedRowKeys = ref<Array<number | string>>([]);
const composing = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let requestSequence = 0;

const editorVisible = ref(false);
const editingId = ref('');
const editForm = reactive({
  answerIndex: 0,
  categoryId: '',
  difficulty: 1,
  explanation: '',
  options: ['', '', '', ''],
  prompt: '',
  tagsText: '',
});

const rejectVisible = ref(false);
const rejectRemark = ref('');
const rejectIds = ref<string[]>([]);

const categoryOptions = computed(() => [
  { label: '全部分类', value: '' },
  ...categories.value.filter((item) => item.enabled).map((item) => ({ label: item.name, value: item.id })),
]);
const statusOptions = [
  { label: '全部发布状态', value: '' },
  { label: '草稿', value: 'DRAFT' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已下线', value: 'OFFLINE' },
];
const reviewOptions = [
  { label: '全部审核状态', value: '' },
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已拒绝', value: 'REJECTED' },
];

const reviewCount = (status: QuizReviewStatus) => summary.value.reviewGroups.find((item) => item.reviewStatus === status)?._count ?? 0;
const publishCount = (status: QuizPublishStatus) => summary.value.statusGroups.find((item) => item.status === status)?._count ?? 0;
const bankTotal = computed(() => summary.value.reviewGroups.reduce((sum, item) => sum + item._count, 0));

function syncQuery() {
  void router.replace({
    query: {
      ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
      ...(statusFilter.value ? { status: statusFilter.value } : {}),
      ...(reviewFilter.value ? { reviewStatus: reviewFilter.value } : {}),
      ...(categoryFilter.value ? { categoryId: categoryFilter.value } : {}),
      page: String(page.value),
      pageSize: String(pageSize.value),
    },
  });
}

async function load() {
  const sequence = ++requestSequence;
  loading.value = true;
  try {
    const result = await getQuizQuestionsApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
      reviewStatus: reviewFilter.value || undefined,
      categoryId: categoryFilter.value || undefined,
    });
    if (sequence !== requestSequence) return;
    rows.value = result.list;
    categories.value = result.categories;
    summary.value = result.summary;
    total.value = result.total;
    checkedRowKeys.value = [];
    syncQuery();
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

function scheduleSearch() {
  if (composing.value) return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    void load();
  }, 300);
}

function finishComposition() {
  composing.value = false;
  scheduleSearch();
}

function openEditor(row: QuizQuestion) {
  editingId.value = row.id;
  editForm.categoryId = row.categoryId;
  editForm.prompt = row.prompt;
  editForm.options = [...row.options];
  editForm.answerIndex = row.answerIndexes[0] ?? 0;
  editForm.explanation = row.explanation ?? '';
  editForm.difficulty = row.difficulty;
  editForm.tagsText = (row.tags ?? []).join('，');
  editorVisible.value = true;
}

async function saveQuestion() {
  const options = editForm.options.map((item) => item.trim());
  if (!editForm.prompt.trim()) return message.error('请填写题干');
  if (options.some((item) => !item)) return message.error('选项不能为空');
  if (editForm.answerIndex >= options.length) return message.error('请选择有效的正确答案');
  saving.value = true;
  try {
    await updateQuizQuestionApi(editingId.value, {
      categoryId: editForm.categoryId,
      prompt: editForm.prompt.trim(),
      options,
      answerIndexes: [editForm.answerIndex],
      explanation: editForm.explanation.trim() || null,
      difficulty: editForm.difficulty,
      tags: editForm.tagsText.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
    });
    editorVisible.value = false;
    message.success('题目已保存，审核状态已重置为待审核');
    await load();
  } finally {
    saving.value = false;
  }
}

async function approve(ids: string[]) {
  if (!ids.length) return;
  saving.value = true;
  try {
    const result = ids.length === 1
      ? await reviewQuizQuestionApi(ids[0]!, { action: 'APPROVE' })
      : await bulkReviewQuizQuestionsApi({ action: 'APPROVE', ids });
    message.success(`已通过 ${result.count} 道题`);
    await load();
  } finally {
    saving.value = false;
  }
}

function openReject(ids: string[]) {
  rejectIds.value = ids;
  rejectRemark.value = '';
  rejectVisible.value = true;
}

async function reject() {
  if (rejectRemark.value.trim().length < 2) return message.error('请填写至少 2 个字的拒绝原因');
  saving.value = true;
  try {
    const result = rejectIds.value.length === 1
      ? await reviewQuizQuestionApi(rejectIds.value[0]!, { action: 'REJECT', remark: rejectRemark.value.trim() })
      : await bulkReviewQuizQuestionsApi({ action: 'REJECT', ids: rejectIds.value, remark: rejectRemark.value.trim() });
    rejectVisible.value = false;
    message.success(`已拒绝 ${result.count} 道题`);
    await load();
  } finally {
    saving.value = false;
  }
}

function changeStatus(row: QuizQuestion, status: 'OFFLINE' | 'PUBLISHED') {
  const publishing = status === 'PUBLISHED';
  dialog.warning({
    title: publishing ? '发布题目' : '下线题目',
    content: publishing
      ? `确认将“${row.prompt}”加入线上题池吗？`
      : `确认下线“${row.prompt}”吗？下线后新答题不会再抽到该题。`,
    positiveText: publishing ? '确认发布' : '确认下线',
    negativeText: '取消',
    onPositiveClick: async () => {
      await updateQuizQuestionStatusApi(row.id, status);
      message.success(publishing ? '题目已发布' : '题目已下线');
      await load();
    },
  });
}

const reviewTag = (status: QuizReviewStatus) => ({ APPROVED: ['已通过', 'success'], PENDING: ['待审核', 'warning'], REJECTED: ['已拒绝', 'error'] } as const)[status];
const publishTag = (status: QuizPublishStatus) => ({ DRAFT: ['草稿', 'default'], PUBLISHED: ['已发布', 'success'], OFFLINE: ['已下线', 'default'] } as const)[status];

const columns: DataTableColumns<QuizQuestion> = [
  { type: 'selection', disabled: () => !canUpdate },
  {
    title: '题目', key: 'prompt', minWidth: 330,
    render: (row) => h('div', { class: 'question-cell' }, [
      h('div', { class: 'question-title' }, row.prompt),
      h('div', { class: 'question-meta' }, `${row.category.name} · 难度 ${row.difficulty} · ${row.sourceName}`),
    ]),
  },
  { title: '审核', key: 'reviewStatus', width: 100, render: (row) => { const tag = reviewTag(row.reviewStatus); return h(NTag, { bordered: false, type: tag[1] }, { default: () => tag[0] }); } },
  { title: '发布', key: 'status', width: 100, render: (row) => { const tag = publishTag(row.status); return h(NTag, { bordered: false, type: tag[1] }, { default: () => tag[0] }); } },
  { title: '来源许可', key: 'sourceLicense', width: 170, render: (row) => h('div', [h('div', row.sourceLicense), h('div', { class: 'question-meta' }, row.sourceRecordId ?? '-')]) },
  {
    title: '操作', key: 'actions', width: canUpdate ? 280 : 90, fixed: 'right',
    render: (row) => h(NSpace, { size: 6 }, { default: () => canUpdate ? [
      h(NButton, { size: 'small', onClick: () => openEditor(row) }, { default: () => '编辑' }),
      h(NButton, { size: 'small', type: 'success', disabled: row.reviewStatus === 'APPROVED', onClick: () => approve([row.id]) }, { default: () => '通过' }),
      h(NButton, { size: 'small', type: 'error', disabled: row.reviewStatus === 'REJECTED', onClick: () => openReject([row.id]) }, { default: () => '拒绝' }),
      row.status === 'PUBLISHED'
        ? h(NButton, { size: 'small', type: 'warning', onClick: () => changeStatus(row, 'OFFLINE') }, { default: () => '下线' })
        : h(NButton, { size: 'small', type: 'primary', disabled: row.reviewStatus !== 'APPROVED', onClick: () => changeStatus(row, 'PUBLISHED') }, { default: () => '发布' }),
    ] : [h(NButton, { size: 'small', onClick: () => openEditor(row) }, { default: () => '查看' })] }),
  },
];

watch(keyword, scheduleSearch);
watch([statusFilter, reviewFilter, categoryFilter], () => { page.value = 1; void load(); });
watch(pageSize, () => { page.value = 1; void load(); });
watch(page, () => void load());
onMounted(load);
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer); requestSequence += 1; });
</script>

<template>
  <Page title="题目审核" description="校对题干、答案与来源后再发布；编辑任何内容都会自动退回待审核。">
    <div class="summary-grid">
      <NCard size="small"><NStatistic label="题库总量" :value="bankTotal" /></NCard>
      <NCard size="small"><NStatistic label="待审核" :value="reviewCount('PENDING')" /></NCard>
      <NCard size="small"><NStatistic label="审核通过" :value="reviewCount('APPROVED')" /></NCard>
      <NCard size="small"><NStatistic label="线上题目" :value="publishCount('PUBLISHED')" /></NCard>
    </div>

    <NCard class="mt-4">
      <div class="filter-toolbar">
        <NInput
          v-model:value="keyword"
          clearable
          class="keyword-filter"
          placeholder="搜索题干、来源记录或外部编号"
          aria-label="搜索题目"
          @compositionstart="composing = true"
          @compositionend="finishComposition"
        />
        <NSelect v-model:value="categoryFilter" :options="categoryOptions" class="compact-filter" aria-label="题目分类" />
        <NSelect v-model:value="reviewFilter" :options="reviewOptions" class="compact-filter" aria-label="审核状态" />
        <NSelect v-model:value="statusFilter" :options="statusOptions" class="compact-filter" aria-label="发布状态" />
        <NButton :loading="loading" @click="load">刷新</NButton>
      </div>

      <NAlert v-if="checkedRowKeys.length" class="selection-bar" type="info" :bordered="false">
        <div class="selection-content">
          <span>已选择 {{ checkedRowKeys.length }} 道题</span>
          <NSpace v-if="canUpdate">
            <NButton size="small" type="success" :loading="saving" @click="approve(checkedRowKeys.map(String))">批量通过</NButton>
            <NButton size="small" type="error" :loading="saving" @click="openReject(checkedRowKeys.map(String))">批量拒绝</NButton>
          </NSpace>
        </div>
      </NAlert>

      <NDataTable
        v-model:checked-row-keys="checkedRowKeys"
        :columns="columns"
        :data="rows"
        :loading="loading"
        :row-key="(row: QuizQuestion) => row.id"
        :scroll-x="1120"
        class="mt-4"
      >
        <template #empty><NEmpty description="没有符合当前筛选条件的题目" /></template>
      </NDataTable>
      <div class="pagination-row">
        <span class="result-count">共 {{ total }} 道题</span>
        <NPagination v-model:page="page" v-model:page-size="pageSize" :item-count="total" :page-sizes="[20, 50, 100]" show-size-picker />
      </div>
    </NCard>

    <NDrawer v-model:show="editorVisible" :width="620" placement="right">
      <NDrawerContent title="校对题目" closable>
        <NAlert type="warning" :bordered="false" class="mb-4">保存后题目会变为“草稿 / 待审核”，需要重新审核才能发布。</NAlert>
        <NForm label-placement="top" :show-require-mark="false">
          <NFormItem label="分类"><NSelect v-model:value="editForm.categoryId" :options="categoryOptions.slice(1)" /></NFormItem>
          <NFormItem label="题干"><NInput v-model:value="editForm.prompt" type="textarea" :rows="3" :resizable="false" maxlength="2000" show-count /></NFormItem>
          <NFormItem label="选项与正确答案">
            <NRadioGroup v-model:value="editForm.answerIndex" class="option-list">
              <div v-for="(_, index) in editForm.options" :key="index" class="option-row">
                <NRadio :value="index" :aria-label="`选项 ${index + 1} 为正确答案`" />
                <NInput v-model:value="editForm.options[index]" :placeholder="`选项 ${index + 1}`" maxlength="500" />
              </div>
            </NRadioGroup>
          </NFormItem>
          <NFormItem label="解析"><NInput v-model:value="editForm.explanation" type="textarea" :rows="4" :resizable="false" maxlength="5000" show-count /></NFormItem>
          <div class="form-grid">
            <NFormItem label="难度"><NInputNumber v-model:value="editForm.difficulty" :min="1" :max="5" class="w-full" /></NFormItem>
            <NFormItem label="标签"><NInput v-model:value="editForm.tagsText" placeholder="多个标签用逗号分隔" /></NFormItem>
          </div>
        </NForm>
        <template #footer>
          <NSpace justify="end"><NButton @click="editorVisible = false">取消</NButton><NButton type="primary" :loading="saving" @click="saveQuestion">保存题目</NButton></NSpace>
        </template>
      </NDrawerContent>
    </NDrawer>

    <NModal v-model:show="rejectVisible" preset="card" title="拒绝题目" class="reject-modal">
      <NAlert type="warning" :bordered="false" class="mb-4">拒绝后题目保持草稿状态，拒绝原因会写入操作审计。</NAlert>
      <NForm label-placement="top">
        <NFormItem label="拒绝原因">
          <NInput v-model:value="rejectRemark" type="textarea" :rows="5" :resizable="false" maxlength="500" show-count placeholder="说明答案、题干或来源存在的问题" />
        </NFormItem>
      </NForm>
      <template #footer><NSpace justify="end"><NButton @click="rejectVisible = false">取消</NButton><NButton type="error" :loading="saving" @click="reject">确认拒绝</NButton></NSpace></template>
    </NModal>
  </Page>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.filter-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.keyword-filter { flex: 1 1 300px; min-width: 240px; }
.compact-filter { width: 150px; }
.selection-bar { margin-top: 16px; }
.selection-content { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.question-cell { padding: 4px 0; }
.question-title { color: var(--n-text-color); font-weight: 600; line-height: 1.55; }
.question-meta { margin-top: 4px; color: var(--n-text-color-3); font-size: 12px; line-height: 1.5; }
.pagination-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 16px; }
.result-count { color: var(--n-text-color-3); font-size: 13px; }
.option-list { display: grid; width: 100%; gap: 10px; }
.option-row { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 8px; }
.form-grid { display: grid; grid-template-columns: 140px 1fr; gap: 16px; }
.reject-modal { width: min(520px, calc(100vw - 32px)); }

@media (max-width: 900px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .summary-grid { grid-template-columns: 1fr; }
  .filter-toolbar { align-items: stretch; flex-direction: column; }
  .keyword-filter, .compact-filter { width: 100%; min-width: 0; }
  .selection-content, .pagination-row { align-items: stretch; flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; gap: 0; }
}
</style>
