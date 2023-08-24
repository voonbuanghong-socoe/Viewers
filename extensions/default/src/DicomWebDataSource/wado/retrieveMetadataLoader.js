/**
 * Class to define inheritance of load retrieve strategy.
 * The process can be async load (lazy) or sync load
 *
 * There are methods that must be implemented at consumer level
 * To retrieve study call execLoad
 */
export default class RetrieveMetadataLoader {
  /**
   * @constructor
   * @param {Object} client The dicomweb-client.
   * @param {Array} studyInstanceUID Study instance ui to be retrieved
   * @param {Object} [filters] - Object containing filters to be applied on retrieve metadata process
   * @param {string} [filter.seriesInstanceUID] - series instance uid to filter results against
   * @param {Object} [sortCriteria] - Custom sort criteria used for series
   * @param {Function} [sortFunction] - Custom sort function for series
   * @param {number} [thresholdLargeStudy] - Threshold used for classify a study as a large studies
   * @param {number} [firstGroupSize] - In case of a large study, fetch first <firstGroupSize> series to display the first image fast to the user
   */
  constructor(
    client,
    studyInstanceUID,
    filters = {},
    sortCriteria = undefined,
    sortFunction = undefined,
    thresholdLargeStudy = 100,
    firstGroupSize = 10
  ) {
    this.client = client;
    this.studyInstanceUID = studyInstanceUID;
    this.filters = filters;
    this.sortCriteria = sortCriteria;
    this.sortFunction = sortFunction;
    this.thresholdLargeStudy = thresholdLargeStudy;
    this.firstGroupSize = firstGroupSize;
  }

  async execLoad() {
    const preLoadData = await this.preLoad();
    const loadData = await this.load(preLoadData);
    const postLoadData = await this.posLoad(loadData);

    return postLoadData;
  }

  /**
   * It iterates over given loaders running each one. Loaders parameters must be bind when getting it.
   * @param {Array} loaders - array of loader to retrieve data.
   */
  async runLoaders(loaders) {
    let result;
    for (const loader of loaders) {
      try {
        result = await loader();
        if (result && result.length) {
          break; // closes iterator in case data is retrieved successfully
        }
      } catch (e) {
        throw e;
      }
    }

    if (loaders.next().done && !result) {
      throw new Error('RetrieveMetadataLoader failed');
    }

    return result;
  }

  // Methods to be overwrite
  async configLoad() { }
  async preLoad() { }
  async load(preLoadData) { }
  async posLoad(loadData) { }
}
