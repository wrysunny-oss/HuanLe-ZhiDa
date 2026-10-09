import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {API_BASE_URL} from '../api/client';
import type {AppDocument} from '../types/api';
import {colors, radii, spacing, typography} from '../theme';
import {AppCard} from './DesignSystem';
import {RichText} from './RichText';

export type LegalDocumentType = 'USER_AGREEMENT' | 'PRIVACY_POLICY';

export function LegalDocumentViewer({type, onBack}: {type: LegalDocumentType; onBack: () => void}) {
  const [document, setDocument] = useState<AppDocument | null>(null);
  const [error, setError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    setError('');
    // 首次同意前也能阅读；避免调用会生成安装标识的业务 API 客户端。
    fetch(`${API_BASE_URL}/operations/documents/${type}`)
      .then(async response => {
        if (!response.ok) throw new Error('文档暂时无法读取，请稍后重试');
        const result = await response.json();
        if (result.code !== 0 || !result.data?.content) {
          throw new Error('文档尚未发布，请稍后重试');
        }
        return result.data as AppDocument;
      })
      .then(value => { if (!cancelled) setDocument(value); })
      .catch(requestError => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : '文档暂时无法读取，请稍后重试');
      });
    return () => { cancelled = true; };
  }, [type, loadAttempt]);

  return (
    <AppCard style={styles.dialog} elevated>
      <Pressable onPress={onBack} accessibilityRole="button">
        <Text style={styles.link}>← 返回</Text>
      </Pressable>
      <Text style={styles.title}>
        {document?.title || (type === 'PRIVACY_POLICY' ? '隐私政策' : '用户协议')}
      </Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {document ? <RichText content={document.content} /> : error ? (
          <View>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => setLoadAttempt(value => value + 1)} accessibilityRole="button">
              <Text style={styles.link}>重试加载</Text>
            </Pressable>
          </View>
        ) : <ActivityIndicator color={colors.primary} />}
      </ScrollView>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  dialog: {width: '100%', maxHeight: '85%', borderRadius: radii.xl, padding: spacing.xl},
  title: {color: colors.text, ...typography.title, marginTop: spacing.lg},
  scroll: {flexShrink: 1, marginTop: spacing.md},
  scrollContent: {paddingBottom: spacing.md},
  error: {color: colors.muted, ...typography.body, lineHeight: 25, marginBottom: spacing.md},
  link: {color: colors.primary, ...typography.label},
});
