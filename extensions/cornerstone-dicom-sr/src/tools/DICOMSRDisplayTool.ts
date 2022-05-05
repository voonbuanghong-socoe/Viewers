import { Types } from '@cornerstonejs/core';
import {
  AnnotationTool,
  annotation,
  drawing,
  utilities,
  Types as cs3DToolsTypes,
} from '@cornerstonejs/tools';
import { getTrackingUniqueIdentifiersForElement } from './modules/dicomSRModule';
import SCOORD_TYPES from '../constants/scoordTypes';

export default class DICOMSRDisplayTool extends AnnotationTool {
  static toolName = 'DICOMSRDisplayTool';

  constructor(
    toolProps = {},
    defaultToolProps = {
      configuration: {},
    }
  ) {
    super(toolProps, defaultToolProps);
  }

  _getTextBoxLinesFromLabels(labels) {
    // TODO -> max 3 for now (label + shortAxis + longAxis), need a generic solution for this!

    const labelLength = Math.min(labels.length, 3);
    const lines = [];

    for (let i = 0; i < labelLength; i++) {
      const labelEntry = labels[i];
      lines.push(`${_labelToShorthand(labelEntry.label)}${labelEntry.value}`);
    }

    return lines;
  }

  // This tool should not inherit from AnnotationTool and we should not need
  // to add the following lines.
  isPointNearTool = () => null;
  getHandleNearImagePoint = () => null;

  renderAnnotation = (
    enabledElement: Types.IEnabledElement,
    svgDrawingHelper: any
  ): void => {
    const { viewport } = enabledElement;
    const { element } = viewport;

    let annotations = annotation.state.getAnnotations(
      element,
      this.getToolName()
    );

    // Todo: We don't need this anymore, filtering happens in triggerAnnotationRender
    if (!annotations?.length) {
      return;
    }

    annotations = this.filterInteractableAnnotationsForElement(
      element,
      annotations
    );

    if (!annotations?.length) {
      return;
    }

    const trackingUniqueIdentifiersForElement = getTrackingUniqueIdentifiersForElement(
      element
    );

    const {
      activeIndex,
      trackingUniqueIdentifiers,
    } = trackingUniqueIdentifiersForElement;

    const activeTrackingUniqueIdentifier =
      trackingUniqueIdentifiers[activeIndex];

    // Filter toolData to only render the data for the active SR.
    const filteredAnnotations = annotations.filter(annotation =>
      trackingUniqueIdentifiers.includes(
        annotation.data?.cachedStats?.TrackingUniqueIdentifier
      )
    );

    if (!viewport._actors?.size) {
      return;
    }

    const styleSpecifier: cs3DToolsTypes.AnnotationStyle.StyleSpecifier = {
      toolGroupId: this.toolGroupId,
      toolName: this.getToolName(),
      viewportId: enabledElement.viewport.id,
    };

    for (let i = 0; i < filteredAnnotations.length; i++) {
      const annotation = filteredAnnotations[i];
      const annotationUID = annotation.annotationUID;
      const { renderableData } = annotation.data.cachedStats;
      const { label, cachedStats } = annotation.data;

      styleSpecifier.annotationUID = annotationUID;

      const lineWidth = this.getStyle('lineWidth', styleSpecifier, annotation);
      const lineDash = this.getStyle('lineDash', styleSpecifier, annotation);
      const color =
        cachedStats.TrackingUniqueIdentifier === activeTrackingUniqueIdentifier
          ? 'rgb(0, 255, 0)'
          : this.getStyle('color', styleSpecifier, annotation);

      const options = {
        color,
        lineDash,
        lineWidth,
      };

      Object.keys(renderableData).forEach(GraphicType => {
        const renderableDataForGraphicType = renderableData[GraphicType];

        let renderMethod;

        switch (GraphicType) {
          case SCOORD_TYPES.POINT:
            renderMethod = this.renderPoint;
            break;
          case SCOORD_TYPES.MULTIPOINT:
            renderMethod = this.renderMultipoint;
            break;
          case SCOORD_TYPES.POLYLINE:
            renderMethod = this.renderPolyLine;
            break;
          case SCOORD_TYPES.CIRCLE:
            renderMethod = this.renderEllipse;
            break;
          case SCOORD_TYPES.ELLIPSE:
            renderMethod = this.renderEllipse;
            break;
          default:
            throw new Error(`Unsupported GraphicType: ${GraphicType}`);
        }

        const canvasCoordinates = renderMethod(
          svgDrawingHelper,
          viewport,
          renderableDataForGraphicType,
          annotationUID,
          options
        );

        if (!canvasCoordinates) {
          return;
        }

        const textLines = this._getTextBoxLinesFromLabels(label);

        let canvasCornersToUseForTextBox = canvasCoordinates;

        if (GraphicType === SCOORD_TYPES.ELLIPSE) {
          canvasCornersToUseForTextBox = utilities.math.ellipse.getCanvasEllipseCorners(
            canvasCoordinates
          );
        }

        const canvasTextBoxCoords = utilities.drawing.getTextBoxCoordsCanvas(
          canvasCornersToUseForTextBox
        );

        annotation.data.handles.textBox.worldPosition = viewport.canvasToWorld(
          canvasTextBoxCoords
        );

        const textBoxPosition = viewport.worldToCanvas(
          annotation.data.handles.textBox.worldPosition
        );

        const textBoxUID = '1';
        const textBoxOptions = this.getLinkedTextBoxStyle(
          styleSpecifier,
          annotation
        );

        const boundingBox = drawing.drawLinkedTextBox(
          svgDrawingHelper,
          annotationUID,
          textBoxUID,
          textLines,
          textBoxPosition,
          canvasCoordinates,
          {},
          {
            ...textBoxOptions,
            color,
          }
        );

        const { x: left, y: top, width, height } = boundingBox;

        annotation.data.handles.textBox.worldBoundingBox = {
          topLeft: viewport.canvasToWorld([left, top]),
          topRight: viewport.canvasToWorld([left + width, top]),
          bottomLeft: viewport.canvasToWorld([left, top + height]),
          bottomRight: viewport.canvasToWorld([left + width, top + height]),
        };
      });
    }
  };

  renderPolyLine(
    svgDrawingHelper,
    viewport,
    renderableData,
    annotationUID,
    options
  ) {
    // Todo: this needs to use the drawPolyLine from cs3D since it is implemented
    // now, before it was implemented with a loop over drawLine which is hacky

    let canvasCoordinates;
    renderableData.map((data, index) => {
      canvasCoordinates = data.map(p => viewport.worldToCanvas(p));

      if (canvasCoordinates.length === 2) {
        const lineUID = `${index}`;
        drawing.drawLine(
          svgDrawingHelper,
          annotationUID,
          lineUID,
          canvasCoordinates[0],
          canvasCoordinates[1],
          {
            color: options.color,
            width: options.lineWidth,
          }
        );
      } else {
        throw new Error('Drawing polyline for SR not yet implemented');
      }
    });

    return canvasCoordinates; // used for drawing textBox
  }

  renderMultipoint(
    svgDrawingHelper,
    viewport,
    renderableData,
    annotationUID,
    options
  ) {
    let canvasCoordinates;
    renderableData.map((data, index) => {
      canvasCoordinates = data.map(p => viewport.worldToCanvas(p));
      const handleGroupUID = '0';
      drawing.drawHandles(
        svgDrawingHelper,
        annotationUID,
        handleGroupUID,
        canvasCoordinates,
        {
          color: options.color,
        }
      );
    });
  }

  renderPoint(
    svgDrawingHelper,
    viewport,
    renderableData,
    annotationUID,
    options
  ) {
    let canvasCoordinates;
    renderableData.map((data, index) => {
      canvasCoordinates = data.map(p => viewport.worldToCanvas(p));
      const arrowUID = `${index}`;
      drawing.drawArrow(
        svgDrawingHelper,
        annotationUID,
        arrowUID,
        canvasCoordinates[1],
        canvasCoordinates[0],
        {
          color: options.color,
          width: options.lineWidth,
        }
      );
    });

    return canvasCoordinates; // used for drawing textBox
  }

  renderEllipse(
    svgDrawingHelper,
    viewport,
    renderableData,
    annotationUID,
    options
  ) {
    let canvasCoordinates;
    renderableData.map((data, index) => {
      if (data.length === 0) {
        // since oblique ellipse is not supported for hydration right now
        // we just return
        return;
      }

      const ellipsePointsWorld = data;

      canvasCoordinates = ellipsePointsWorld.map(p =>
        viewport.worldToCanvas(p)
      );

      const canvasCorners = <Array<Types.Point2>>(
        utilities.math.ellipse.getCanvasEllipseCorners(canvasCoordinates)
      );

      const lineUID = `${index}`;
      drawing.drawEllipse(
        svgDrawingHelper,
        annotationUID,
        lineUID,
        canvasCorners[0],
        canvasCorners[1],
        {
          color: options.color,
          width: options.lineWidth,
        }
      );
    });

    return canvasCoordinates;
  }
}

const SHORT_HAND_MAP = {
  'Short Axis': 'W ',
  'Long Axis': 'L ',
  AREA: 'Area ',
  Length: '',
  CORNERSTONEFREETEXT: '',
};

function _labelToShorthand(label) {
  const shortHand = SHORT_HAND_MAP[label];

  if (shortHand !== undefined) {
    return shortHand;
  }

  return label;
}
