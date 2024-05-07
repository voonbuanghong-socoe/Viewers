import { CommandsManager } from '@ohif/core';

export type ColorMapPreset = {
  ColorSpace;
  description: string;
  RGBPoints;
  Name;
};

export type ColormapProps = {
  viewportId: string;
  commandsManager: CommandsManager;
  serviceManager: AppTypes.ServicesManager;
  colormaps: Array<ColorMapPreset>;
  displaySets: Array<any>;
};
