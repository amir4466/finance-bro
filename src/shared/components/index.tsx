import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { C } from '../theme';
import { styles } from '../../application/styles';

function PixelBuddy({ size = 5 }: { size?: number }) {
  const rows = [
    '....GGGG....', '....GGGG....', '....GGGG....', '.....OO.....',
    '...RRRRRR...', '..RRSSSSRR..', '..RROOORR...', '.BBYYYYYYBB.',
    '.BBBBBBBBBB.', 'RR.BBPPBB.RR', '...PP..PP...',
  ];
  const colors: Record<string, string> = { G: '#9AD36F', O: C.onyx, R: C.scarlet, S: '#FFE3D4', B: '#9DB9CE', Y: '#F5C64D', P: '#8473B0' };
  return (
    <View accessibilityLabel="Finance Bro pixel buddy" style={{ width: 12 * size, height: rows.length * size, flexDirection: 'column' }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ height: size, flexDirection: 'row' }}>
          {row.split('').map((cell, columnIndex) => <View key={columnIndex} style={{ width: size, height: size, backgroundColor: colors[cell] ?? 'transparent' }} />)}
        </View>
      ))}
    </View>
  );
}

function Sheet({ visible, title, onClose, children, onSave, saveLabel = 'Save' }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode; onSave?: () => void; saveLabel?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetDock}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12}><Text style={styles.sheetClose}>×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>{children}</ScrollView>
            {onSave && <Pressable style={styles.primaryButton} onPress={onSave}><Text style={styles.primaryButtonText}>{saveLabel}</Text></Pressable>}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry = false, multiline = false }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'default' | 'numeric' | 'decimal-pad'; secureTextEntry?: boolean; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} keyboardType={keyboardType} secureTextEntry={secureTextEntry} multiline={multiline} style={[styles.input, multiline && styles.multilineInput]} />
    </View>
  );
}

function ChoiceRow({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((option) => (
        <Pressable key={option} onPress={() => onChange(option)} style={[styles.choice, value === option && styles.choiceSelected]}>
          <Text style={[styles.choiceText, value === option && styles.choiceTextSelected]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && <Pressable onPress={onAction}><Text style={styles.actionText}>{action}</Text></Pressable>}
    </View>
  );
}

function EmptyState({ icon, title, detail, action, onAction }: { icon: string; title: string; detail: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>{icon}</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text>
      {action && onAction && <Pressable style={styles.outlineButton} onPress={onAction}><Text style={styles.outlineButtonText}>{action}</Text></Pressable>}
    </View>
  );
}
export { PixelBuddy, Sheet, Field, ChoiceRow, SectionTitle, EmptyState };
