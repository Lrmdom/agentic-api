import { Annotation } from "@langchain/langgraph";

export const MarketingState = Annotation.Root({
  messages: Annotation<any[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  currentProfile: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  commerceData: Annotation<any>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
});
