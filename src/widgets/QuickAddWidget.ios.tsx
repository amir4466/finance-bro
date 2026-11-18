import { Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

const QuickAddWidget = () => {
  'widget';

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[
        containerBackground('#202A33', 'widget'),
        widgetURL('financebro://quick-add'),
        padding({ all: 16 }),
      ]}
    >
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle('#AFC4D2')]}>FINANCE BRO</Text>
      <Text modifiers={[font({ size: 20, weight: 'bold' }), foregroundStyle('#FFFFFF')]}>＋ Add expense</Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle('#D2DCE3')]}>Tap to log spending</Text>
    </VStack>
  );
};

export default createWidget('QuickAddWidget', QuickAddWidget);
