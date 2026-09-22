/**
 * splicr v1.0.1 · 缩略图应用适配器
 *
 * 将 @splicr/ui 的纯展示型 ThumbnailImage 组件绑定到应用的 useAssets().thumbnail
 */

import {
  ThumbnailImage as PureThumbnailImage,
  type ThumbnailImageProps as PureProps,
} from "@splicr/ui";
import { useAssets } from "@hooks/useAssets";

export interface ThumbnailImageProps extends Omit<PureProps, "fetchThumbnail"> {
  fetchThumbnail?: PureProps["fetchThumbnail"];
}

export function ThumbnailImage(props: ThumbnailImageProps) {
  const { thumbnail } = useAssets();
  return (
    <PureThumbnailImage
      fetchThumbnail={props.fetchThumbnail ?? thumbnail}
      {...props}
    />
  );
}
