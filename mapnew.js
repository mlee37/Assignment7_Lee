import Map from "https://js.arcgis.com/4.33/@arcgis/core/Map.js";
import MapView from "https://js.arcgis.com/4.33/@arcgis/core/views/MapView.js";
import FeatureLayer from "https://js.arcgis.com/4.33/@arcgis/core/layers/FeatureLayer.js";
import Legend from "https://js.arcgis.com/4.33/@arcgis/core/widgets/Legend.js";
import Graphic from "https://js.arcgis.com/4.33/@arcgis/core/Graphic.js";

window.addEventListener("DOMContentLoaded", () => {
  const statesLayer = new FeatureLayer({
    url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/USA_States_Generalized_Boundaries/FeatureServer/0",
    title: "US States",
    popupTemplate: {
      // autocast as esri/PopupTemplate
      title: "{STATE_NAME }",
      content:
        "Population: {POPULATION }  "
    },
    opacity: 0.9
  });

  const map = new Map({
    basemap: "gray-vector",
    layers: []
  });

  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [-100.3487846, 39.58907],
    zoom: 3
  });

  const legend = new Legend({
    view: view
  });

  view.ui.add(legend, "bottom-left");
  var $table = $('#table')

  // initialize bootstrap-table so insertRow/removeAll work
  // Ensures plugin methods are available.
  if ($table && $table.length) {
    $table.bootstrapTable();
  }
  // flags to track async data readiness
  //!! create a new flag variable for your added new data like following two datasets, set it  to true once that data finishes loading

  let statesLoaded = false;
  let disabilityPctLoaded = false;

  // disable submit until required data is loaded
  const submitBtn = document.querySelector('form button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  // fallback: if data hasn't loaded after 10s, enable submit anyway
  setTimeout(() => {
    if (submitBtn && submitBtn.disabled) {
      submitBtn.disabled = false;
      console.warn('Submit enabled after timeout — some data may be missing.');
    }
  }, 10000);

  // function to load state geometries into stateObj
  var loadStates = function () {
    var table = document.getElementById("myTable");


    //stateObj.js defines a global variable and it is executed before referencing mapnew.js in index.html
    // Create an empty <tr> element and add it to the 1st position of the table:
    Object.entries(stateObj).sort().forEach(([key, value], index) => {
      // console.log(`${index}: ${key} = ${value}`);

      $table.bootstrapTable('insertRow', {
        index: index,
        row: {
          state: key.replace("_", " "),

        }

      })

    });
    let query = statesLayer.createQuery();
    //   query.where = "1==1"
    query.returnGeometry = true;
    query.outFields = ["STATE_ABBR", "STATE_NAME"];

    statesLayer.queryFeatures(query)
      .then(function (response) {
        console.log(response)
        response.features.forEach(function (feature, ind) {
          var abbr = feature.attributes.STATE_ABBR;
          if (abbr && abbr !== "DC") {
            // find matching key in stateObj by abbreviation (more robust than matching by name)
            var matchKey = Object.keys(stateObj).find(k => {
              return stateObj[k] && stateObj[k].abb && stateObj[k].abb.toUpperCase() === abbr.toUpperCase();
            });
            if (matchKey) {
              stateObj[matchKey]['geometry'] = feature.geometry;
            } else {
              console.warn('loadStates: no matching stateObj entry for', abbr, feature.attributes.STATE_NAME);
            }
          }

        })
        console.log('loadStates: geometry loaded for states');
        statesLoaded = true;
        //!!if you have a new dataset, you also need to check if all are loaded before enabling submit in the following if statement.
        if (statesLoaded && disabilityPctLoaded) {
          if (submitBtn) submitBtn.disabled = false;
          console.log('All data loaded — submit enabled');
        }
        console.log(stateObj)
        //!! If you have a new dataset, you also need to update the condition if below to include your new flag variable.
      }).catch(function (err) {
        console.error('loadStates failed:', err);
        // avoid leaving submit permanently disabled
        statesLoaded = true;
        if (disabilityPctLoaded && submitBtn) submitBtn.disabled = false;
      });



  }
  loadStates()
  ///this is where you'll query an additional service to add more data to you mapping dashboard
  ///here are some examples
  //this example is from the URL below
  //https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/ACS_Median_Income_by_Race_and_Age_Selp_Emp_Boundaries/FeatureServer
  //however, there are a whole bunch of state level datasets you can use here:
  // repository for american community survey services: https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services 

  //Create a feature layer from your URL, this is the url for state layer.
  var disabilityPctUrl = "https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/ACS_Disability_by_Type_Boundaries/FeatureServer/0"
  const disabilityPctLayer = new FeatureLayer({
    url: disabilityPctUrl,
    title: "Percent Population With a Disability",
  });

  //Make function to execture query
  var loadAdditionalData = function () {
    ////Create a new query object and give it the correct properties for what you want
    let additionalQuery = disabilityPctLayer.createQuery();
    additionalQuery.returnGeometry = false;
    additionalQuery.outFields = "*"
    ////execute query on your new layer
    disabilityPctLayer.queryFeatures(additionalQuery).then(function (r) {
      console.log(r)
      r.features.forEach(function (feature) {
        // prefer matching by postal abbreviation (STUSPS)
        var abbr = feature.attributes && feature.attributes['STUSPS'];
        if (!abbr || abbr === "DC") return;

        // find matching key in stateObj by abb (case-insensitive)
        var matchKey = Object.keys(stateObj).find(k => {
          return stateObj[k] && stateObj[k].abb && stateObj[k].abb.toUpperCase() === abbr.toUpperCase();
        });

        if (!matchKey) {
          console.warn('loadAdditionalData: no matching stateObj entry for', abbr, feature.attributes.NAME);
          return;
        }

        // the median income field sometimes differs; try the expected field, else inspect attributes
        var disabilityPct = null;
        if ('C18108_calc_pctDE' in feature.attributes) {
          disabilityPct = feature.attributes['C18108_calc_pctDE'];
        } else if ('disabilityPct' in feature.attributes) { // example fallback
          disabilityPct = feature.attributes['disabilityPct'];
        } else {
          // if the expected field isn't present, log available keys to pick the correct one
          console.warn('loadAdditionalData: disability field not found for', abbr, 'attributes keys:', Object.keys(feature.attributes));
        }

        // set medianIncome (may be null if no field found)
        stateObj[matchKey]['disabilityPct'] = disabilityPct;
      });
      console.log('loadAdditionalData: disability percent loaded');
      disabilityPctLoaded = true;
      if (statesLoaded && disabilityPctLoaded) {
        if (submitBtn) submitBtn.disabled = false;
        console.log('All data loaded — submit enabled');
      }
    }).catch(function (err) {
      console.error('loadAdditionalData failed:', err);
      disabilityPctLoaded = true;
      if (statesLoaded && disabilityPctLoaded) {
        if (submitBtn) submitBtn.disabled = false;
      } else {
        if (submitBtn) submitBtn.disabled = false;
      }
    })
  }

  loadAdditionalData()


  // helper function to find tax rate for given income
  const between = (x, min, max) => {
    return x >= min && x <= max;
  }
  const getRate = function (arr, inc) {
    if (!arr || !Array.isArray(arr.range) || !Array.isArray(arr.rate)) {
      return [0, 0];
    }
    let taxRate = 0;
    for (var i = 0; i < arr.range.length; i++) {
      if (between(inc, arr.range[i][0], arr.range[i][1])) {
        taxRate = arr.rate[i];
        return [taxRate, arr.range[i][0]];
      }
    }
    // fallback: return last rate if not matched
    return [arr.rate[arr.rate.length - 1] || 0, arr.range[arr.range.length - 1] ? arr.range[arr.range.length - 1][0] : 0];
  }
  const formElement = document.querySelector('form')
  formElement.addEventListener("submit", (e) => {
    // on form submission, prevent default
    e.preventDefault();
    $table.bootstrapTable('removeAll');

    // parse numeric inputs and chosen filing status using the declared formElement
    var income = Number(formElement.querySelector('input[name="income"]').value.replaceAll(",", "")) || 0;
    var married = formElement.querySelector('input[name="marriedRadios"]:checked').value === 'married';
    var dependents = Number($('#dependents').val()) || 0;
    console.log('Filing status:', married ? 'Married' : 'Single', 'dependents:', dependents, 'income:', income);
    var graphics = []
    if (income > 100000000) {
      alert("Sorry, you make too much money for this tool to be useful")
    }
    else {
      Object.entries(stateObj).forEach(([key, value], index) => {
        try {
          if (value.notax == true) {
            $table.bootstrapTable('insertRow', {
              index: index,
              row: {
                state: key.replace("_", " "),
                incomeAfterTaxes: income.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                grossDifference: 0,
                percentDifference: 0,
                ////Add new row to states with no tax///
                disabilityPct: value.disabilityPct,
              }
            })
            if (value.geometry) {
              let gfx = new Graphic({
                geometry: value.geometry,
                attributes: {
                  "Income_Before_Taxes": income.toString(),
                  "Income_After_Taxes": income.toString(),
                  "Total_State_Tax_Owed": 0,
                  "State_Abbr": value.abb,
                  "PercentOwed": 0,
                  "ObjectId": index
                }
              });
              graphics.push(gfx)
            } else {
              console.warn('No geometry for state (noTax), skipping graphic:', key);
            }
          }
          else {
            // declare locals to avoid leaking to outer scope
            let rateArr, rate = 0, bracket = 0, incomeWithExemptions = 0, taxBeforeCredits = 0, taxAfterCreditsRaw = 0, totalTax = 0, totalExemptions = 0, totalCredits = 0;

            if (married == true) {
              // married filers should use married_brackets and married SD/exemptions
              rateArr = getRate(value.married_brackets, income)
              rate = rateArr[0]
              bracket = rateArr[1]
              incomeWithExemptions = income - (value.SD_married || 0) - (value.married_exemption || 0) - ((value.dependent_exemption || 0) * dependents)
              taxBeforeCredits = incomeWithExemptions * rate
              taxAfterCreditsRaw = taxBeforeCredits - (value.married_credit || 0) - ((value.dependent_credit || 0) * dependents)
              totalTax = taxAfterCreditsRaw > 0 ? Math.trunc(taxAfterCreditsRaw) : 0
              totalExemptions = (value.SD_married || 0) + ((value.dependent_exemption || 0) * dependents) + (value.married_exemption || 0)
              totalCredits = ((value.dependent_credit || 0) * dependents) + (value.married_credit || 0)
            }
            else {
              // single filers use single_brackets and single SD/exemptions
              rateArr = getRate(value.single_brackets, income)
              rate = rateArr[0]
              bracket = rateArr[1]
              incomeWithExemptions = income - (value.SD_single || 0) - (value.personal_exemption || 0) - ((value.dependent_exemption || 0) * dependents)
              taxBeforeCredits = incomeWithExemptions * rate
              taxAfterCreditsRaw = taxBeforeCredits - (value.personal_credit || 0) - ((value.dependent_credit || 0) * dependents)
              totalTax = taxAfterCreditsRaw > 0 ? Math.trunc(taxAfterCreditsRaw) : 0
              totalExemptions = (value.SD_single || 0) + ((value.dependent_exemption || 0) * dependents) + (value.personal_exemption || 0)
              totalCredits = ((value.dependent_credit || 0) * dependents) + (value.personal_credit || 0)
            }

            // safe percent calculation
            let percent = (income > 0) ? ((totalTax / income) * 100) : 0;

            $table.bootstrapTable('insertRow', {
              index: index,
              row: {
                state: key.replace("_", " "),
                bracket: (rate * 100).toFixed(2),
                incomeAfterTaxes: Math.trunc((income - totalTax)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                grossDifference: Math.trunc(totalTax).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                percentDifference: percent.toFixed(2),
                totalExemptions: Math.trunc(totalExemptions).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                totalCredits: Math.trunc(totalCredits).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                ///////////Add new row here too //////////                            
                disabilityPct: value.disabilityPct

              }
            })
            value['incomeBeforeTaxes'] = Math.trunc(income)
            value['incomeAfterTaxes'] = Math.trunc((income - totalTax))
            value['grossDifference'] = Math.trunc(totalTax)
            value['percentDifference'] = percent
            value['bracket'] = (bracket !== undefined && bracket !== null) ? bracket.toString().replace("[", "").replace("]", "") : "0"
            if (value.geometry) {
              let gfx = new Graphic({
                geometry: value.geometry,
                attributes: {
                  "Income_Before_Taxes": value['incomeBeforeTaxes'],
                  "Income_After_Taxes": value['incomeAfterTaxes'],
                  "Total_State_Tax_Owed": value['grossDifference'],
                  "State_Abbr": value.abb,
                  "PercentOwed": Number(value['percentDifference']) || 0,
                  "ObjectId": index
                }
              });
              graphics.push(gfx)
            } else {
              console.warn('No geometry for state, skipping graphic:', key);
            }

            $("th[data-field='percentDifference'] .sortable").click();
          }
        }
        catch (err) {
          console.error('Error processing state', key, err);
        }
      })
      console.log(stateObj)
    }
    // remove the original statesLayer if present, but don't remove the basemap or all layers
    try {
      if (map.layers && map.layers.length) {
        // remove the original feature layer preview if it exists
        map.layers.forEach(function (lyr) {
          if (lyr && (lyr.title === 'US States' || lyr.title === 'State Tax Layer')) {
            map.layers.remove(lyr);
          }
        });
      }
    } catch (err) {
      console.warn('Error removing previous layer:', err);
    }
    const noTax = {
      type: "simple-fill", // autocasts as new SimpleFillSymbol()
      color: "#0c7d3f",
      style: "solid",
      outline: {
        width: 0.2,
        color: [255, 255, 255, 0.5]
      }
    };

    const under3 = {
      type: "simple-fill", // autocasts as new SimpleFillSymbol()
      color: "#99bf47",
      style: "solid",
      outline: {
        width: 0.2,
        color: [255, 255, 255, 0.5]
      }
    };

    const threeToFive = {
      type: "simple-fill", // autocasts as new SimpleFillSymbol()
      color: "#d6a206",
      style: "solid",
      outline: {
        width: 0.2,
        color: [255, 255, 255, 0.5]
      }
    };

    const over5 = {
      type: "simple-fill", // autocasts as new SimpleFillSymbol()
      color: "#c42f02",
      style: "solid",
      outline: {
        width: 0.2,
        color: [255, 255, 255, 0.5]
      }
    };
    const renderer = {
      type: "class-breaks", // autocasts as new ClassBreaksRenderer()
      field: "PercentOwed",
      legendOptions: {
        title: "Total Actual State Tax Owed"
      },
      defaultSymbol: {
        type: "simple-fill", // autocasts as new SimpleFillSymbol()
        color: "black",
        style: "backward-diagonal",
        outline: {
          width: 0.5,
          color: [50, 50, 50, 0.6]
        }
      },
      defaultLabel: "no data",
      classBreakInfos: [
        {
          minValue: 0,
          maxValue: 0,
          symbol: noTax,
          label: "No tax"
        },
        {
          minValue: 0.01,
          maxValue: 3,
          symbol: under3,
          label: "0 - 3%"
        },
        {
          minValue: 3,
          maxValue: 5,
          symbol: threeToFive,
          label: "3 - 5%"
        },
        {
          minValue: 5.01,
          maxValue: 100,
          symbol: over5,
          label: "more than 5%"
        }
      ]
    };
    console.log('Graphics prepared, count =', graphics ? graphics.length : 0);
    if (!graphics || graphics.length === 0) {
      console.warn('No graphics to display as a layer — choropleth will not be added.');
      return;
    }

    const layer = new FeatureLayer({
      source: graphics,  // array of graphics objects
      objectIdField: "ObjectId",
      title: "State Tax Layer",
      fields: [{
        name: "ObjectId",
        type: "oid"
      }, {
        name: "Income_Before_Taxes",
        type: "double"
      },
      {
        name: "Income_After_Taxes",
        type: "double"
      }, {
        name: "Total_State_Tax_Owed",
        type: "double"
      },
      {
        name: "PercentOwed",
        type: "double"
      },
      {
        name: "State_Abbr",
        type: "string"
      },
      ],
      popupTemplate: {
        content: "State: {State_Abbr} <br>" +
          "State tax as percent of income: %{PercentOwed} <br>" +
          "Total State Tax Owed: {Total_State_Tax_Owed} <br>" +
          "Income after states taxes: {Income_After_Taxes}"
      },
      renderer: renderer

    });

    console.log('Adding State Tax Layer to map with', graphics.length, 'graphics');
    map.add(layer);
  });
});