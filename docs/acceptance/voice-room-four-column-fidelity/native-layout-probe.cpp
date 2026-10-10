
#include <yoga/Yoga.h>
#include <cassert>
#include <iostream>
YGNodeRef row(YGConfigRef config, float width, bool legacy) {
  auto n=YGNodeNewWithConfig(config);
  YGNodeStyleSetWidth(n,width);
  YGNodeStyleSetFlexDirection(n,YGFlexDirectionRow);
  YGNodeStyleSetFlexWrap(n,legacy?YGWrapWrap:YGWrapNoWrap);
  if(legacy) YGNodeStyleSetGap(n,YGGutterColumn,14);
  for(int i=0;i<4;i++) {
    auto c=YGNodeNewWithConfig(config);
    if(legacy) YGNodeStyleSetWidth(c,76);
    else {YGNodeStyleSetWidthPercent(c,25);YGNodeStyleSetFlexShrink(c,0);YGNodeStyleSetMinWidth(c,0);}
    YGNodeStyleSetHeight(c,74);YGNodeInsertChild(n,c,i);
  }
  YGNodeCalculateLayout(n,YGUndefined,YGUndefined,YGDirectionLTR);
  return n;
}
int main() {
  for(float pixelRatio:{1.f,2.f,3.f})for(int viewport:{320,360,390,412}) {
    auto config=YGConfigNew();YGConfigSetPointScaleFactor(config,pixelRatio);
    auto n=row(config,viewport-31,false);
    for(int i=0;i<4;i++) {
      auto c=YGNodeGetChild(n,i);assert(YGNodeLayoutGetTop(c)==0);
      assert(YGNodeLayoutGetLeft(c)+YGNodeLayoutGetWidth(c)<=viewport-31+.01f);
    }
    assert(YGNodeLayoutGetHeight(n)==74);
    std::cout<<"PASS native Yoga viewport="<<viewport<<" ratio="<<pixelRatio<<" four columns height=74\n";
    YGNodeFreeRecursive(n);YGConfigFree(config);
  }
  auto c=YGConfigNew();auto old=row(c,329,true);
  assert(YGNodeLayoutGetTop(YGNodeGetChild(old,3))==74);
  std::cout<<"REPRODUCED old 360px viewport: fourth seat wraps to y=74\n";
  YGNodeFreeRecursive(old);YGConfigFree(c);
}
