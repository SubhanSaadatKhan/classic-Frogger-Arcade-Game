import "./style.css";

import { fromEvent, interval, merge } from 'rxjs';
import { map, filter, scan } from 'rxjs/operators';


function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */

  /**
   * This is the view for your game to add and update your game elements.
   */
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
  const displayCurrScore = document.querySelector("#currScore") as HTMLElement
  const displayHighScore = document.querySelector("#highScore") as HTMLElement
  const displayLevel = document.querySelector("#level") as HTMLElement

  //Only one KeyboardEvent is used in this game  
  type Event = "keydown"

  //Only these five keys are used as controls 
  type Key = "ArrowRight" | "ArrowLeft" | "ArrowUp" | "ArrowDown" | 'r' //These are the only four keys used as controls

  //These are the objects in the game, this is used to identify each object type
  type ViewType = "frog" | "car" | "truck" | "sportcar" | "monstruck" | "log" | "timberlog" | "croc" | "lightlog" | "turtle"

  //Constants that are used all round the program, name of variables are self explanatory
  const constants = {
    CanvasSize: 600,
    PointsEveryMoveAction: 10,
    FrogWidth: 20,
    FrogHeight: 20,
    StartTime: 0,
    FrogStartPos: { x: 270, y: 580 },
    FrogVelocity: 40,
    FrogRadius: 10,
    Column: 3,
    rows: 0,
    LogColor: "#80471C",
    TurtleColor: "yellow",
    CrocColor: "#013220",
    CarColor: "white",
    TruckColor: "red",
    FrogColor: "green",
    ColumnExp: 2,
    WaterObjSpeed: 0.5,
    GroundObjSpeed: 1,
    TargetAreaY: 56,
    TargetAreaYLim: 91,
    TargetArea1X: 71,
    TargetArea1XLim: 130,
    TargetArea2X: 200,
    TargetArea2XLim: 260,
    TargetArea3X: 330,
    TargetArea3XLim: 395,
    TargetArea4X: 465,
    TargetArea4XLim: 529,
    TurtleStartXPos: 0,
    TurtleStartYPos: 160,
    TurtleXDist: 200,
    TurtleHeight: 20,
    TurtleWidth: 100,
    LightLogStartXPos: 50,
    LightLogStartYPos: 120,
    CrocStartXPos: 0,
    CrocStartYPos: 240,
    CrocXDist: 200,
    CrocHeight: 20,
    CrocWidth: 130,
    TimberLogStartXPos: 50,
    TimberLogStartYPos: 200,
    LogStartXPos: 0,
    LogStartYPos: 280,
    LogXDist: 300,
    LogHeight: 20,
    LogWidth: 280,
    MonsTruckStartXPos: 50,
    MonsTruckStartYPos: 385,
    SportCarStartXPos: 550,
    SportCarStartYPos: 425,
    TruckStartXPos: 0,
    TruckStartYPos: 465,
    TruckXDist: 150,
    TruckHeight: 25,
    TruckWidth: 70,
    CarStartXPos: 580,
    CarStartYPos: 520,
    CarXDist: -150,
    CarHeight: 25,
    CarWidth: 20,
  } as const

  /** 
  * Each of these classes refres to a specific kind of action that takes place in the game 
  * @Tick Behaves as a game clock keeping track of the time within the game. 
  * @Move Determines which way to move the frog 
  * @Restart Determines what needs to happen when the user restart the game
  * * Source: Code inspired from FRP Asteroids Course Notes.
  */
  class Tick { constructor(public readonly elapsed: number) { } }
  class Move { constructor(public readonly direction: number, public readonly horizontal: boolean, public readonly action: string | null = null) { } }
  class Restart { constructor() { } }

  /**
  * @VecMotion Class is similar to the Vec Class in FRP Asteroids Course Notes it is used to determine values for linear motion  
  */
  class VecMotion {
    constructor(public readonly x: number = 0, public readonly y: number = 0) { }
    add = (b: VecMotion) => new VecMotion(this.x + b.x, this.y + b.y);
    sub = (b: VecMotion) => this.add(b.scale(-1));
    scale = (s: number) => new VecMotion(this.x * s, this.y * s);

    static Zero = new VecMotion();
  }

  /**
  Generalising properties for onjects that participate in the game
  */
  type Body = Readonly<{
    id: string, //each object will have a unique id
    pos: VecMotion,
    velocity: number,
    objHeight: number,
    objWidth: number,
    objColor: string,
    motionDirection: boolean | null
    createTime: number
  }>

  /**
  * The game structure is build upto the Model-View-Controller architecture. 
  * Each tick of the game clock holds a unique state consisting of the properties mentioned below 
  */
  type State = Readonly<{
    time: number,
    frog: Body,
    cars: ReadonlyArray<Body>,
    trucks: ReadonlyArray<Body>,
    sportcars: ReadonlyArray<Body>,
    monstrucks: ReadonlyArray<Body>,
    logs: ReadonlyArray<Body>,
    timberlogs: ReadonlyArray<Body>,
    crocs: ReadonlyArray<Body>,
    lightlogs: ReadonlyArray<Body>,
    turtles: ReadonlyArray<Body>,
    removeAble: ReadonlyArray<Body>,
    objCount: number //total object count in the game
    gameOver: Boolean,
    onLog: Boolean,
    frogLastLocation: VecMotion,
    // reachedTargetArea: Boolean,//Indicates if the frog have reached a distinct target location
    showReachedSign: Boolean, //Indicates if we need to display an SVG element as a sign that the frog has already reached this area
    horizontal: boolean, //Frog movement indicator, frog moves along the x-axis if true otherwise y-axis
    countTarget: number, //Keeps track of the number of targer areas reached by the frog
    restart: Boolean,
    currScore: number, //every move-up action means 10 points, on successful reaching a target area means 50 points
    highScore: number,
    level: number, //level increases after every distinct location is reached by the frog
    subMerged: boolean //indicates weather the turtle is currently submerged or not
  }>

  /**
  * The following type fixedObjProp is a type for initialstate positioning for fixed objects at the start state. 
  * You may find description of unusual properties below. 
  */
  type fixedObjProp = Readonly<{
    vT: ViewType,
    rows: number, //number of columns for a particular static object
    columns: number,  //number of columns for a particular static object
    velocity: number,
    x_axis_start: number,  //The starting x position of the first static object
    y_axis_start: number,  //The starting y position of the first static object
    x_diff: number, //Indicates how far should each object be apart from each other horizontally
    direction: boolean,
    fixedHeight: number, //Object's height 
    fixedWidth: number //Object's width
    fixedColor: string //Object's width
  }>

  //Static Car initial state
  const propertyCar: fixedObjProp = {
    vT: "car",
    rows: constants.rows,
    columns: constants.Column,
    velocity: constants.GroundObjSpeed,
    x_axis_start: constants.CarStartXPos,
    y_axis_start: constants.CarStartYPos,
    x_diff: constants.CarXDist,
    direction: false,
    fixedHeight: constants.CarHeight,
    fixedWidth: constants.CarWidth,
    fixedColor: constants.CarColor
  }

  //Static Truck initial state
  const propertyTruck: fixedObjProp = {
    vT: "truck",
    columns: constants.Column,
    rows: constants.rows,
    velocity: constants.GroundObjSpeed,
    x_axis_start: constants.TruckStartXPos,
    y_axis_start: constants.TruckStartYPos,
    x_diff: constants.TruckXDist,
    direction: true,
    fixedHeight: constants.TruckHeight,
    fixedWidth: constants.TruckWidth,
    fixedColor: constants.TruckColor
  }
  //Static SportCar initial state
  const propertySportCar: fixedObjProp = {
    vT: "sportcar",
    columns: constants.Column,
    rows: constants.rows,
    velocity: constants.GroundObjSpeed,
    x_axis_start: constants.SportCarStartXPos,
    y_axis_start: constants.SportCarStartYPos,
    x_diff: constants.CarXDist,
    direction: false,
    fixedHeight: constants.CarHeight,
    fixedWidth: constants.CarWidth,
    fixedColor: constants.CarColor
  }
  //Static MonsTruck initial state
  const propertyMonsTruck: fixedObjProp = {
    vT: "monstruck",
    columns: constants.Column,
    rows: constants.rows,
    velocity: constants.GroundObjSpeed,
    x_axis_start: constants.MonsTruckStartXPos,
    y_axis_start: constants.MonsTruckStartYPos,
    x_diff: constants.TruckXDist,
    direction: true,
    fixedHeight: constants.TruckHeight,
    fixedWidth: constants.TruckWidth,
    fixedColor: constants.TruckColor
  }
  //Static Log initial state
  const propertyLog: fixedObjProp = {
    vT: "log",
    rows: constants.ColumnExp,
    columns: constants.Column,
    velocity: constants.WaterObjSpeed,
    x_axis_start: constants.LogStartXPos,
    y_axis_start: constants.LogStartYPos,
    x_diff: constants.LogXDist,
    direction: true,
    fixedHeight: constants.LogHeight,
    fixedWidth: constants.LogWidth,
    fixedColor: constants.LogColor
  }
  //Static TimberLog initial state
  const propertyTimberLog: fixedObjProp = {
    vT: "timberlog",
    rows: constants.rows,
    columns: constants.ColumnExp,
    velocity: constants.WaterObjSpeed,
    x_axis_start: constants.TimberLogStartXPos,
    y_axis_start: constants.TimberLogStartYPos,
    x_diff: constants.LogXDist,
    direction: true,
    fixedHeight: constants.LogHeight,
    fixedWidth: constants.LogWidth,
    fixedColor: constants.LogColor
  }
  //Static Croc initial state
  const propertyCroc: fixedObjProp = {
    vT: "croc",
    rows: constants.rows,
    columns: constants.Column,
    velocity: constants.WaterObjSpeed,
    x_axis_start: constants.CrocStartXPos,
    y_axis_start: constants.CrocStartYPos,
    x_diff: constants.CrocXDist,
    direction: true,
    fixedHeight: constants.CrocHeight,
    fixedWidth: constants.CrocWidth,
    fixedColor: constants.CrocColor
  }
  //Static LightLog initial state
  const propertyLightLog: fixedObjProp = {
    vT: "lightlog",
    rows: constants.rows,
    columns: constants.ColumnExp,
    velocity: constants.WaterObjSpeed,
    x_axis_start: constants.LightLogStartXPos,
    y_axis_start: constants.LightLogStartYPos,
    x_diff: constants.LogXDist,
    direction: true,
    fixedHeight: constants.LogHeight,
    fixedWidth: constants.LogWidth,
    fixedColor: constants.LogColor
  }
  //Static Turtle initial state
  const propertyTurtle: fixedObjProp = {
    vT: "turtle",
    rows: constants.rows,
    columns: constants.Column,
    velocity: constants.WaterObjSpeed,
    x_axis_start: constants.TurtleStartXPos,
    y_axis_start: constants.TurtleStartYPos,
    x_diff: constants.TurtleXDist,
    direction: true,
    fixedHeight: constants.TurtleHeight,
    fixedWidth: constants.TurtleWidth,
    fixedColor: constants.TurtleColor
  }

  /**
  * @param p:fixedObjProp Takes in fixedObjProp type  
  * @returns An array of game Objects with the initialized properties. 
  */
  const formFixedObj = (p: fixedObjProp) =>
    [...Array((p.columns)).keys()].map(
      (val, index) =>
      ({
        id: String(Math.floor(val / (p.columns))) + String(index % (p.columns)) + p.vT,
        createTime: 0,
        pos: new VecMotion(p.x_axis_start + index % (p.columns) * (p.x_diff), p.y_axis_start),
        velocity: p.velocity,
        motionDirection: p.direction,
        objHeight: p.fixedHeight,
        objWidth: p.fixedWidth,
        objColor: p.fixedColor
      }))

  const lstFixedCars = formFixedObj(propertyCar)
  const lstFixedTrucks = formFixedObj(propertyTruck)
  const lstFixedSportCars = formFixedObj(propertySportCar)
  const lstFixedMonsTrucks = formFixedObj(propertyMonsTruck)
  const lstFixedLogs = formFixedObj(propertyLog)
  const lstFixedTimberLogs = formFixedObj(propertyTimberLog)
  const lstFixedLightLogs = formFixedObj(propertyLightLog)
  const lstFixedCrocs = formFixedObj(propertyCroc)
  const lstFixedTurtles = formFixedObj(propertyTurtle)


  //Initial States of the game
  const initialState: State = {
    time: 0,
    frog: {
      id: "frogCharacter",
      pos: new VecMotion(constants.FrogStartPos.x, constants.FrogStartPos.y),
      velocity: constants.FrogVelocity,
      createTime: 0,
      motionDirection: null,
      objHeight: constants.FrogHeight,
      objWidth: constants.FrogWidth,
      objColor: constants.FrogColor
    },
    cars: lstFixedCars,
    trucks: lstFixedTrucks,
    sportcars: lstFixedSportCars,
    monstrucks: lstFixedMonsTrucks,
    logs: lstFixedLogs,
    timberlogs: lstFixedTimberLogs,
    crocs: lstFixedCrocs,
    lightlogs: lstFixedLightLogs,
    turtles: lstFixedTurtles,
    removeAble: [],
    objCount: 0,
    gameOver: false,
    onLog: false,
    // reachedTargetArea: false,
    frogLastLocation: new VecMotion(constants.FrogStartPos.x, constants.FrogStartPos.y),
    showReachedSign: false,
    countTarget: 0,
    horizontal: false,
    restart: false,
    currScore: 0,
    highScore: 0,
    level: 0,
    subMerged: false 
  }

  /**
   * * observeKey function (Pure function)
   * @param e Takes in a specified Event Type 
   * @param k Takes in a specified Key Type
   * @param result Transforms the key event into a class object
   * @returns An observable stream containing objects of classes defined above
   * * Source: Code inspired from FRP Asteroids Course Notes.
   */

  const observeKey = <T>(e: Event, k: Key, result: () => T) => fromEvent<KeyboardEvent>(document, e).
    pipe(filter(({ key }) => key === k),
      filter(({ repeat }) => !repeat),
      map(result))

  const moveLeft = observeKey('keydown', 'ArrowLeft', () => new Move(-1, true))
  const moveRight = observeKey('keydown', 'ArrowRight', () => new Move(1, true))
  const moveDown = observeKey('keydown', 'ArrowDown', () => new Move(1, false))
  const moveUp = observeKey('keydown', 'ArrowUp', () => new Move(-1, false, 'MoveUp'))
  const restartGame = observeKey('keydown', 'r', () => new Restart())

  /**
   * * reduceState function (Pure function)
   * @param s Takes in a previous game state.
   * @param e Takes in the objects of action classes defined above 
   * @returns A unique state is returned depending on the action provoked 
   * Details of each different returns are as below.
   * If instanceof... 
   * @Move returns a new state such that the position of the frog is changed where everything remains same.
   * @Restart returns a new state such the previous highscore is carried forward whereas initialState is restored through ...initialState.
   * @else call the function tick which returns a new state according to the game clock
   */
  const reduceState = (s: State, e: Move | Tick | Restart): State =>
    e instanceof Move ? {
      ...s,
      frog: {
        ...s.frog,
        // Updating the position of the frog depending on its movement either horizontal or vertical
        pos: e.horizontal ? s.frog.pos.add(new VecMotion(s.frog.velocity * e.direction, 0)) : s.frog.pos.add(new VecMotion(0, s.frog.velocity * e.direction))
      },
      // Updating the current score +10 for a move-up action
      currScore: e.action === 'MoveUp' ? s.currScore + constants.PointsEveryMoveAction : s.currScore,
      //keeping track of frog's last location, need this in update view function
      frogLastLocation: new VecMotion(s.frog.pos.x, s.frog.pos.y)

    } :
      e instanceof Restart ? {
        ...initialState, // Taking properties from the initial state, as restart brings the game to its original form
        time: 0,
        restart: true,
        highScore: s.highScore > s.currScore ? s.highScore : s.currScore //carry back the highscore after restarting
      } :
        tick(s, e)


  /**
   * * collisionIdentify function (Pure Function)
   * @param param0 Takes in an array of game Objects consisting of two objects with one being the frog
   * @returns true if frog collides with any object, else false 
   * * Source: Inspired from https://www.jeffreythompson.org/collision-detection/circle-rect.php
   */
  function collisionIdentify([a, b]: [Body, Body], head: number = 0): boolean {
    const testingX = (a.pos.x < b.pos.x) ? b.pos.x : (a.pos.x > b.pos.x + (b.objWidth - head)) ? b.pos.x + (b.objWidth - head) : a.pos.x,
      testingY = (a.pos.y < b.pos.y) ? b.pos.y : (a.pos.y > b.pos.y + b.objHeight) ? b.pos.y + b.objHeight : a.pos.y,
      distX = a.pos.x - testingX,
      distY = a.pos.y - testingY,
      distance = Math.sqrt((distX * distX) + (distY * distY))

    return (distance <= constants.FrogRadius) ? true : false
  }


  /**
   * * handleCollisions function (Pure Function)
   * @param s A game state for, uses it for collision checking.
   * @returns A new state after handling the objects that collided
   */
  const handleCollisions = (s: State): State => {
    //checking collision of frog with every object in the game

    const carsAndFrog = s.cars.filter(c => collisionIdentify([s.frog, c])).length > 0
    const trucksAndFrog = s.trucks.filter(c => collisionIdentify([s.frog, c])).length > 0
    const sportcarsAndFrog = s.sportcars.filter(c => collisionIdentify([s.frog, c])).length > 0
    const monstrucksAndFrog = s.monstrucks.filter(c => collisionIdentify([s.frog, c])).length > 0
    const logsAndFrog = s.logs.filter(c => collisionIdentify([s.frog, c])).length > 0
    const timberlogsAndFrog = s.timberlogs.filter(c => collisionIdentify([s.frog, c])).length > 0
    const lightlogsAndFrog = s.lightlogs.filter(c => collisionIdentify([s.frog, c])).length > 0
    const crocsAndFrog = s.crocs.filter(c => collisionIdentify([s.frog, c], 50)).length > 0
    const turtlesAndFrog = s.turtles.filter(c => collisionIdentify([s.frog, c])).length > 0

    return <State>{
      ...s,
      //Gameover true when frog collided with any object in the groud section or falls into the water or climbs on top of a submerged turtle.
      gameOver: (s.subMerged && turtlesAndFrog) || carsAndFrog || trucksAndFrog || sportcarsAndFrog || monstrucksAndFrog || ((s.frog.pos.y < 312 && s.frog.pos.y > 120) && (!logsAndFrog && !timberlogsAndFrog && !lightlogsAndFrog && !crocsAndFrog && !turtlesAndFrog)),

      onLog: (logsAndFrog || timberlogsAndFrog || lightlogsAndFrog || crocsAndFrog || (turtlesAndFrog && !s.subMerged)) ? true : false
    }

  }

  /**
   * * checkFrogInTargetArea function (Pure function)
   * @param s Takes in a state 
   * @returns A boolean, depending on weather the frog has reached any of the distinct target areas.
   */
  const checkFrogInTargetArea = (s: State): boolean => {
    return s.frog.pos.y < constants.TargetAreaYLim ? (s.frog.pos.x > constants.TargetArea1X && s.frog.pos.x < constants.TargetArea1XLim) || (s.frog.pos.x >= constants.TargetArea2X && s.frog.pos.x <= constants.TargetArea2XLim) || (s.frog.pos.x >= constants.TargetArea3X && s.frog.pos.x <= constants.TargetArea3XLim) || (s.frog.pos.x >= constants.TargetArea4X && s.frog.pos.x <= constants.TargetArea4XLim) ? true : false : false
  }

  /**
   * * createCircleAtTarget function (Pure function)
   * @param s Takes in a state 
   * @returns nothing, just creates a red circle at a distinct target area after frog reaches it.
   */
  const createCircleAtTarget = (s: State): void => {
    //checking location of frog against each distinct location to determine where to insert the red circle
    if (s.showReachedSign) {
      const xVal = (s.frogLastLocation.x > constants.TargetArea1X && s.frogLastLocation.x < constants.TargetArea1XLim) ? (constants.TargetArea1X + constants.TargetArea1XLim) / 2 : (s.frogLastLocation.x > constants.TargetArea2X && s.frogLastLocation.x < constants.TargetArea2XLim) ? (constants.TargetArea2X + constants.TargetArea2XLim) / 2 : (s.frogLastLocation.x > constants.TargetArea3X && s.frogLastLocation.x < constants.TargetArea3XLim) ? (constants.TargetArea3X + constants.TargetArea3XLim) / 2 : (s.frogLastLocation.x > constants.TargetArea4X && s.frogLastLocation.x < constants.TargetArea4XLim) ? (constants.TargetArea4X + constants.TargetArea4XLim) / 2 : 0

      //creating red circle for indication
      const show = document.createElementNS(svg.namespaceURI, "circle");
      show.setAttribute("r", "15");
      show.setAttribute("cx", `${xVal}`);
      show.setAttribute("cy", `${s.frogLastLocation.y - 28}`);
      show.setAttribute("class", 'showClass');
      show.setAttribute(
        "style",
        "fill: red; stroke: purple; stroke-width: 1px;"
      );
      svg.appendChild(show);
    }
  }
  /**
   * * observeKey function (Pure function)
   * @param {x,y} takes in an object of VecMotion Class
   * @returns an object of VecMotion class having the updated x and y positions
   * * Source: Code inspired from FRP Asteroids Course Notes.
   */
  function torusWrap({ x, y }: VecMotion): VecMotion {
    const size = constants.CanvasSize
    const wrap = (position_x: number) => position_x > size ? position_x - size : position_x < 0 ? position_x + size : position_x
    return new VecMotion(wrap(x), y)
  }

  /**
   * * submergeTurtle function (Pure function)
   * @param gArr takes in an array of objects (specifically turtles)
   * @returns nothing, change each turtles visibility attribute to "hidden" if it is "visible" and vise versa
   */
  const submergeTurtle = (gArr: ReadonlyArray<Body>) =>
    gArr.forEach(function (g) {
      const rmable = document.getElementById(`${g.id}`) as HTMLElement;
      rmable.style.visibility === 'visible' ? rmable.style.visibility = 'hidden' : rmable.style.visibility = 'visible'
    })


  /**
   * * submergeTurtle function (Pure function) a condition checking function for submerging action
   * @param s Takes in a state
   * @returns boolean, indicatin if the turtle can now submerge
   */
  const checkSubMerging = (s: State, num: number): Boolean => (num > 0 && num % 100 === 0 && !(s.gameOver || s.countTarget === 4)) ? true : false




  /**
   * * tick function (Pure function)
   * @param s Takes in a state 
   * @returns A different state based on different game conditions
   * * Source: Code inspired from FRP Asteroids Course Notes. 
   */
  const tick = (s: State, e: Tick) => {
    const varSpeed = (constants.WaterObjSpeed + s.level * 0.1)
    
    //This function handles the animation of all rows, in other words it enables the object to move forward or backwards
    const animateObjects = (gArr: ReadonlyArray<Body>): ReadonlyArray<Body> =>
      gArr.map((g) => ({ ...g, pos: g.motionDirection ? new VecMotion(g.pos.x + (g.velocity + s.level * 0.1), g.pos.y) : new VecMotion(g.pos.x - (g.velocity + s.level * 0.1), g.pos.y) }))

    //This function updates the position of the object if it exceeds the canvas size
    const checkObjects = (gArr: ReadonlyArray<Body>): ReadonlyArray<Body> =>
      animateObjects(gArr).map((g) => ({ ...g, pos: g.motionDirection ? torusWrap(g.pos) : torusWrap(g.pos) }))

    //this block of code is responsible for SubMerging turtle
    if (checkSubMerging(s, e.elapsed)) {
      submergeTurtle(s.turtles)
    }

    // returning different states based on game conditions
    return s.gameOver || s.countTarget === 4 ? <State>{
      ...s, //if gameover or all 4 distinct target area have been reached then just return the 
    } : handleCollisions(<State>{ //if game not over or all distinct target areas have not been filled then we check for collisions
      ...s,
      frog: {
        ...s.frog,
        //adjusts the position of frog if it has reached a target location then send to initial position else if frog is on a log then update its position according to speed of waterObjects
        pos: checkFrogInTargetArea(s) ? new VecMotion(constants.FrogStartPos.x, constants.FrogStartPos.y) : s.onLog ? torusWrap(s.frog.pos.add(new VecMotion(varSpeed,0))) : torusWrap(s.frog.pos)
      },
      cars: checkObjects(s.cars),
      trucks: checkObjects(s.trucks),
      sportcars: checkObjects(s.sportcars),
      monstrucks: checkObjects(s.monstrucks),
      logs: checkObjects(s.logs),
      timberlogs: checkObjects(s.timberlogs),
      crocs: checkObjects(s.crocs),
      lightlogs: checkObjects(s.lightlogs),
      turtles: checkObjects(s.turtles),
      showReachedSign: checkFrogInTargetArea(s),
      currScore: checkFrogInTargetArea(s) ? s.currScore + 4 * constants.PointsEveryMoveAction : s.currScore,
      highScore: s.currScore > s.highScore ? s.currScore : s.highScore,
      countTarget: checkFrogInTargetArea(s) ? s.countTarget + 1 : s.countTarget,
      restart: false,
      level: checkFrogInTargetArea(s) ? s.level + 1 : s.level,
      subMerged: checkSubMerging(s, e.elapsed) ? true : false 
    })

  }

  //Main stream of observables
  merge(interval(10).pipe(map(elapsed => new Tick(elapsed))), moveLeft, moveRight, moveUp, moveDown, restartGame).pipe(
    scan(reduceState, initialState)
  ).subscribe(updateView)

  /**
   * * updateView function (impure function)
   * @param s: Takes in a state which determines how the SVG canvas would look like
   * * Source: Code inspired from FRP Asteroids Course Notes.
   */
  function updateView(s: State) {
    frog.setAttribute('cx', `${s.frog.pos.x}`)
    frog.setAttribute('cy', `${s.frog.pos.y}`)
    svg.appendChild(frog);


    displayCurrScore.innerHTML = `${s.currScore}`
    displayLevel.innerHTML = `${s.level}`

    //reaching all 4 distinct target areas also finishes the game
    if (s.gameOver || s.countTarget === 4) {

      createCircleAtTarget(s)

      //displays the updated highscore (if applicable)
      displayHighScore.innerHTML = `${s.currScore > s.highScore ? s.currScore : s.highScore}`

      const v = document.getElementById("gameover");
      //If the game is still on going, v will return null meaning it is not present in the DOM 
      //If it is not present in the DOM, then draw it
      if (v === null) {
        const v = document.createElementNS(svg.namespaceURI, "text")!;
        v.setAttribute('x', `35`);
        v.setAttribute('y', `300`);
        v.setAttribute('fill', 'black');
        v.setAttribute('stroke', 'white');
        v.setAttribute('font-size', '40');
        v.setAttribute('id', "gameover");
        v.textContent = "Game Over: Press r to restart";
        svg.appendChild(v);
      }
    }
    //if none of the above conditions then the gameover text will be removed (if applicable)
    else {
      try {
        const v = document.getElementById("gameover") as HTMLElement;
        svg.removeChild(v)

      } catch (error) { }
      if (s.restart) { //If user has triggered restart action remove all "Red Circle" indicators, this is done to bring the game back to its original form

        try {
          const k = document.querySelectorAll('.showClass')
          k.forEach(target => {
            target.remove();
          });
        } catch (error) { }
      }
    }

    createCircleAtTarget(s) //creating circle if frog reaches target location
    /**
    * * updateRectView, a generalized rectangle svg element creator (impure function)
    * @param b takes in a game object and draws it on the SVG canvas depending on its properties. 
    * @param classType indicates unique classtype for ech type of object. 
    * * Source: FRP Asteroids, Final View Section, https://tgdwyer.github.io/asteroids/
    */
    const updateRectView = (b: Body, classType: string) => {
      //This inner function creates the elements, on the SVG canvas. 
      function createRectView() {
        const v = document.createElementNS(svg.namespaceURI, "rect");
        v.setAttribute("id", `${b.id}`)
        v.setAttribute("width", `${b.objWidth}`)
        v.setAttribute("height", `${b.objHeight}`)
        v.setAttribute("fill", `${b.objColor}`)
        v.setAttribute("visibility", 'visible')
        v.classList.add(classType)
        svg.appendChild(v)
        return v
      }
      const v = document.getElementById(b.id)
      if (v) {
        v.setAttribute("x", `${b.pos.x}`);
        v.setAttribute("y", `${b.pos.y}`);
      }
      else {
        createRectView();
      }
    };

    //Call updateRectView to display all the objects on the SVG canvas

    s.cars.forEach(obj => updateRectView(obj, "Cars"));
    s.trucks.forEach(obj => updateRectView(obj, "Trucks"));
    s.sportcars.forEach(obj => updateRectView(obj, "Bikes"));
    s.monstrucks.forEach(obj => updateRectView(obj, "Trucks2"));
    s.logs.forEach(obj => updateRectView(obj, "Logs"));
    s.timberlogs.forEach(obj => updateRectView(obj, "Logs2"));
    s.crocs.forEach(obj => updateRectView(obj, "Crocs"));
    s.lightlogs.forEach(obj => updateRectView(obj, "Logs3"));
    s.turtles.forEach(obj => updateRectView(obj, "Turtles"));

    //this piece of code removes all objects from the SVG canvas as soon as game over or user finishes the game.
    if (s.gameOver || s.countTarget === 4) {
      s.cars.concat(s.trucks, s.sportcars, s.monstrucks, s.logs, s.crocs, s.timberlogs, s.lightlogs, s.turtles, s.frog).map(s => document.getElementById(s.id) as HTMLElement).filter((item) => item !== null || undefined)
        .forEach(v => { try { svg.removeChild(v) } catch (e) { console.log("Already removed: " + v.id) } });

    }


  }

  // Hardcoded some SVG elements used for UI 

  //water
  const water = document.createElementNS(svg.namespaceURI, "rect");
  water.setAttribute("x", "0");
  water.setAttribute("y", "120");
  water.setAttribute("width", "600");
  water.setAttribute("height", "190");
  water.setAttribute("opacity", "0.4");
  water.setAttribute(
    "style",
    "fill: #007577; stroke: #007577; stroke-width: 1px;"
  );
  svg.appendChild(water);

  //safe zone
  const safeZone2 = document.createElementNS(svg.namespaceURI, "rect");
  safeZone2.setAttribute("x", "0");
  safeZone2.setAttribute("y", "312");
  safeZone2.setAttribute("width", "600");
  safeZone2.setAttribute("height", "50");
  safeZone2.setAttribute("opacity", "0.1");
  safeZone2.setAttribute(
    "style",
    "fill: yellow; stroke: brown; stroke-width: 1px;"
  );
  svg.appendChild(safeZone2);

  //LANDING ROW
  const row = document.createElementNS(svg.namespaceURI, "rect");
  // row.setAttribute("x", "0");
  row.setAttribute("y", "35");
  row.setAttribute("width", "600");
  row.setAttribute("height", "20");
  row.setAttribute(
    "style",
    "fill: green; stroke: green; stroke-width: 1px;"
  );
  svg.appendChild(row);

  //LANDING BLOCK
  const block1 = document.createElementNS(svg.namespaceURI, "rect");
  block1.setAttribute("x", "529");
  block1.setAttribute("y", "56");
  block1.setAttribute("width", "70");
  block1.setAttribute("height", "30");
  block1.setAttribute(
    "style",
    "fill: green; stroke: red; stroke-width: 1px;"
  );
  svg.appendChild(block1);

  //LANDING BLOCK 1
  const block2 = document.createElementNS(svg.namespaceURI, "rect");
  block2.setAttribute("x", "1");
  block2.setAttribute("y", "56");
  block2.setAttribute("width", "70");
  block2.setAttribute("height", "30");
  block2.setAttribute(
    "style",
    "fill: green; stroke: red; stroke-width: 1px;"
  );
  svg.appendChild(block2);

  //LANDING BLOCK
  const block3 = document.createElementNS(svg.namespaceURI, "rect");
  block3.setAttribute("x", "130");
  block3.setAttribute("y", "56");
  block3.setAttribute("width", "70");
  block3.setAttribute("height", "30");
  block3.setAttribute(
    "style",
    "fill: green; stroke: red; stroke-width: 1px;"
  );
  svg.appendChild(block3);

  //LANDING BLOCK
  const block4 = document.createElementNS(svg.namespaceURI, "rect");
  block4.setAttribute("x", "260");
  block4.setAttribute("y", "56");
  block4.setAttribute("width", "70");
  block4.setAttribute("height", "30");
  block4.setAttribute(
    "style",
    "fill: green; stroke: red; stroke-width: 1px;"
  );
  svg.appendChild(block4);

  //LANDING BLOCK
  const block5 = document.createElementNS(svg.namespaceURI, "rect");
  block5.setAttribute("x", "395");
  block5.setAttribute("y", "56");
  block5.setAttribute("width", "70");
  block5.setAttribute("height", "30");
  block5.setAttribute(
    "style",
    "fill: green; stroke: red; stroke-width: 1px;"
  );
  svg.appendChild(block5);

  const frog = document.createElementNS(svg.namespaceURI, "circle");
  frog.setAttribute("r", `${constants.FrogRadius}`);
  frog.setAttribute("id", "frogCharacter")
  // frog.setAttribute("overflow", "visible");
  frog.setAttribute("visibility", "visible");
  frog.setAttribute(
    "style",
    "fill: green; stroke: green; stroke-width: 1px;"
  );
  // svg.appendChild(frog);


}






// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
